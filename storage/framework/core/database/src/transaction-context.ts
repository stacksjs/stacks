/**
 * Transaction context (stacksjs/stacks#1882, Q-3 from #1872).
 *
 * Background: queued dispatches issued inside `db.transaction(...)`
 * used to fire IMMEDIATELY — the worker could pick up the job and
 * try to load `orders.id` before the transaction committed,
 * operating on rows that didn't exist yet (or that got rolled back
 * after the job ran). The classic shape:
 *
 * ```ts
 * await db.transaction(async (trx) => {
 *   const order = await trx.insertInto('orders')...
 *   await job('ProcessOrder', { orderId: order.id }).dispatch()
 *   // … more work that might throw and rollback
 * })
 * ```
 *
 * Fix: wrap the user's transaction callback inside an
 * AsyncLocalStorage scope. Dispatches inside the scope record an
 * "after-commit" callback instead of executing; on successful
 * commit the framework flushes them; on rollback they get dropped.
 *
 * The buffering primitive lives here (in `@stacksjs/database`)
 * because both the transaction wrapper (`@stacksjs/orm`) and the
 * queue (`@stacksjs/queue`) need to access it — keeping it in
 * the lowest-level package avoids a circular dep.
 *
 * Cross-cutting concerns (mailer side-effects, audit logs that
 * should also fire post-commit, cache invalidation) can hook the
 * same primitive by calling {@link enqueueAfterCommit} directly
 * without going through the queue facade.
 */

import { AsyncLocalStorage } from 'node:async_hooks'

/**
 * One buffered side-effect waiting for the surrounding transaction
 * to commit. Errors thrown during flush are NOT re-thrown — the
 * transaction itself already committed, so failing the whole flow
 * after-the-fact would corrupt the caller's mental model. Errors
 * are logged via `onError` if the scope supplied one.
 */
type AfterCommitCallback = () => Promise<void> | void

interface TransactionScope {
  /** Buffered callbacks to fire after the outer transaction commits. */
  pending: Array<{ callback: AfterCommitCallback, owner: TransactionScope }>
  /** The savepoint's parent; callbacks remain owned until the outer commit. */
  parent?: TransactionScope
  /** Closed scopes cannot enroll new work from lingering async continuations. */
  accepting: boolean
  /**
   * Optional error handler invoked when a buffered callback throws
   * during flush. Defaults to `console.error` so failures aren't
   * silently dropped, but the surrounding flow continues.
   */
  onError?: (err: unknown, index: number) => void
}

const transactionStorage = new AsyncLocalStorage<TransactionScope>()

/**
 * True if the current async context is inside an active transaction
 * scope. Queue dispatch (and other side-effect emitters) read this
 * to decide between immediate execution and buffering.
 */
export function isInTransaction(): boolean {
  return transactionStorage.getStore() !== undefined
}

/**
 * Enqueue a callback to fire after the surrounding transaction
 * commits. Returns:
 *   - `true`: handled, either buffered or discarded from a closed scope
 *   - `false`: no transaction context; caller should execute immediately
 *
 * This is the low-level primitive. Higher-level facades (queue
 * dispatch, mailer send, event emit) wrap it with their own
 * "respect transaction context unless overridden" logic.
 */
export function enqueueAfterCommit(callback: AfterCommitCallback): boolean {
  const scope = transactionStorage.getStore()
  if (!scope) return false
  for (let owner: TransactionScope | undefined = scope; owner; owner = owner.parent) {
    // Consume rather than return false: false tells the dispatcher to execute
    // immediately, which would let rolled-back work escape the buffer entirely.
    if (!owner.accepting)
      return true
  }
  scope.pending.push({ callback, owner: scope })
  return true
}

/**
 * Run `fn` inside a transaction scope. Returns whatever `fn`
 * returns. On success, fires every buffered after-commit callback
 * in insertion order. On error, discards them — the transaction
 * rolled back so the side-effects shouldn't happen.
 *
 * Used by `@stacksjs/orm`'s `transaction()` wrapper to thread the
 * scope through user code. Apps don't call this directly.
 *
 * Nested calls share an ordered buffer but keep distinct owners. A failed
 * savepoint discards only its own callbacks and its descendants' callbacks;
 * a successful savepoint still waits for the outermost commit to flush.
 * The callback receives an attempt runner for driver retries. Starting a new
 * attempt discards the previous one's callbacks even if COMMIT, rather than
 * the callback, failed. Each attempt gets its own async-context owner.
 */
export async function runInTransactionScope<T>(
  fn: (runAttempt: <R>(callback: () => Promise<R>) => Promise<R>) => Promise<T>,
  options: { onError?: (err: unknown, index: number) => void } = {},
): Promise<T> {
  const parent = transactionStorage.getStore()
  const scope: TransactionScope = {
    pending: parent?.pending ?? [],
    parent,
    accepting: true,
    onError: parent?.onError ?? options.onError,
  }
  let previousAttempt: TransactionScope | undefined
  const runAttempt = async <R>(callback: () => Promise<R>): Promise<R> => {
    if (previousAttempt)
      discardScope(previousAttempt)
    const attempt: TransactionScope = { pending: scope.pending, parent: scope, accepting: true, onError: scope.onError }
    previousAttempt = attempt
    return runOwnedScope(attempt, callback)
  }
  const result = await runOwnedScope(scope, () => fn(runAttempt))
  // Commit path — fire each callback in order. Errors are swallowed
  // by default (with onError if provided) because the commit
  // already landed; throwing here would falsely tell the caller
  // their write didn't happen.
  if (!parent)
    await flushScope(scope)
  return result
}

async function runOwnedScope<T>(scope: TransactionScope, callback: () => Promise<T>): Promise<T> {
  try {
    return await transactionStorage.run(scope, callback)
  }
  catch (error) {
    discardScope(scope)
    throw error
  }
  finally {
    scope.accepting = false
  }
}

function discardScope(scope: TransactionScope): void {
  scope.accepting = false
  // Truncating at the starting length would also discard callbacks that
  // concurrent parent/sibling contexts enrolled while this one awaited.
  for (let i = scope.pending.length - 1; i >= 0; i--) {
    let owner: TransactionScope | undefined = scope.pending[i]!.owner
    while (owner && owner !== scope)
      owner = owner.parent
    if (owner === scope)
      scope.pending.splice(i, 1)
  }
}

async function flushScope(scope: TransactionScope): Promise<void> {
  for (let i = 0; i < scope.pending.length; i++) {
    try {
      await scope.pending[i]!.callback()
    }
    catch (err) {
      if (scope.onError) {
        try { scope.onError(err, i) }
        catch { /* swallow secondary failure */ }
      }
      else {
        // eslint-disable-next-line no-console
        console.error('[transaction-context] after-commit callback threw:', err)
      }
    }
  }
  scope.pending.length = 0
}

/**
 * Test-only escape hatch — manually flush the current scope's
 * buffered callbacks without ending the transaction. Production
 * code never needs this; tests use it to assert intermediate
 * state. Returns the number of callbacks fired.
 */
export async function __flushAfterCommitNow(): Promise<number> {
  const scope = transactionStorage.getStore()
  if (!scope) return 0
  const count = scope.pending.length
  await flushScope(scope)
  return count
}

/**
 * Test-only escape hatch — peek at the number of buffered
 * callbacks without firing them. Returns 0 outside a scope.
 */
export function __pendingAfterCommitCount(): number {
  return transactionStorage.getStore()?.pending.length ?? 0
}
