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
 * await db.transaction().execute(async (trx) => {
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
  pending: AfterCommitCallback[]
  /**
   * Depth of nested `db.transaction(...)` calls within this scope.
   * Nested transactions (savepoints) fire on the OUTER commit, not
   * the savepoint commit — Eloquent semantics.
   */
  depth: number
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
 *   - `true`  — buffered; caller should NOT execute the side-effect now
 *   - `false` — no active transaction; caller should execute immediately
 *
 * This is the low-level primitive. Higher-level facades (queue
 * dispatch, mailer send, event emit) wrap it with their own
 * "respect transaction context unless overridden" logic.
 */
export function enqueueAfterCommit(callback: AfterCommitCallback): boolean {
  const scope = transactionStorage.getStore()
  if (!scope) return false
  scope.pending.push(callback)
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
 * Nested calls reuse the outer scope rather than nesting — flush
 * happens on the OUTERMOST commit, matching the savepoint
 * semantics of every relational database. The depth counter is
 * tracked so the outer call knows when it owns the flush.
 */
export async function runInTransactionScope<T>(
  fn: () => Promise<T>,
  options: { onError?: (err: unknown, index: number) => void } = {},
): Promise<T> {
  const existing = transactionStorage.getStore()
  if (existing) {
    // Nested: just track depth and let the outer scope handle flush.
    existing.depth += 1
    try {
      return await fn()
    }
    finally {
      existing.depth -= 1
    }
  }

  const scope: TransactionScope = {
    pending: [],
    depth: 1,
    onError: options.onError,
  }
  let result: T
  try {
    result = await transactionStorage.run(scope, fn)
  }
  catch (err) {
    // Rollback path — drop buffered callbacks without invoking them.
    // They were predicated on the commit landing.
    scope.pending.length = 0
    throw err
  }

  // Commit path — fire each callback in order. Errors are swallowed
  // by default (with onError if provided) because the commit
  // already landed; throwing here would falsely tell the caller
  // their write didn't happen.
  await flushScope(scope)
  return result
}

async function flushScope(scope: TransactionScope): Promise<void> {
  for (let i = 0; i < scope.pending.length; i++) {
    try {
      await scope.pending[i]!()
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
