/**
 * Read replica routing.
 *
 * Splitting reads onto replicas is the first real scaling step for an app
 * that has outgrown one database server, and it is the layer a sharding
 * proxy eventually sits behind. It is also the easiest thing in this file
 * to get subtly, intermittently wrong, so the safety rules are encoded
 * here rather than left to each call site.
 *
 * ## The hazard
 *
 * Replication is asynchronous. A row committed to the primary is not
 * immediately on the replica — typically milliseconds behind, occasionally
 * seconds under load. So this sequence is a bug:
 *
 *   await User.create({ email })     // primary
 *   const user = await User.where('email', email).first()   // replica: null
 *
 * The failure is load-dependent and vanishes under a debugger, which is
 * exactly the kind of bug a framework should refuse to hand its users by
 * default. Hence three rules:
 *
 *  1. **Auto-routing is opt-in** (`reads.autoRoute`, default false). An app
 *     that has not said it tolerates stale reads never gets them. `db.read`
 *     stays available for callers who want a replica explicitly.
 *
 *  2. **Never route inside a transaction.** A transaction's reads must see
 *     its own uncommitted writes, and its statements must all reach one
 *     connection. Routing a SELECT out of a transaction is never right.
 *
 *  3. **Never route after a write in the same async context.** Once a
 *     request has written, its subsequent reads go to the primary, which
 *     buys read-your-writes for the overwhelmingly common case: a request
 *     that reads back what it just wrote. This is tracked with
 *     AsyncLocalStorage so it follows the request across awaits without
 *     any caller threading a flag through.
 *
 * Rule 3 is per-async-context, not global — a write in request A must not
 * force request B onto the primary, or the first write of any busy process
 * would collapse all read traffic back onto it.
 *
 * ## What this does not do
 *
 * It does not verify replication health or measure lag. A replica that has
 * fallen far behind still receives traffic. Detecting that is the
 * provisioning layer's job (`ts-cloud` tracks `replicationLag` on the
 * replicas it manages); doing it here would mean a health probe on the
 * read path, which costs more than it saves.
 */

import { AsyncLocalStorage } from 'node:async_hooks'
import type { ReadPolicyConfig, ReplicaConfig } from './driver-config'

/**
 * Per-async-context routing state.
 *
 * `wroteInContext` implements rule 3. It is a mutable box rather than a
 * plain boolean because the flag is set *after* the store is established —
 * a write deep inside a request has to be visible to reads that happen
 * later in that same request, and `AsyncLocalStorage.getStore()` returns
 * the same object reference throughout.
 */
interface RoutingContext {
  wroteInContext: boolean
  inTransaction: boolean
}

const routingContext = new AsyncLocalStorage<RoutingContext>()

/**
 * Run `fn` in a fresh routing context.
 *
 * Called per request by the HTTP layer so read-your-writes is scoped to
 * one request. Without an enclosing context the router falls back to
 * treating every read as routable, which is the correct behavior for
 * background work that has no request boundary to speak of — such work
 * should use `db.read` explicitly if it wants a replica.
 */
export function withRoutingContext<T>(fn: () => T): T {
  return routingContext.run({ wroteInContext: false, inTransaction: false }, fn)
}

/** Record that the current context has written, pinning its later reads. */
export function markContextWrote(): void {
  const store = routingContext.getStore()
  if (store)
    store.wroteInContext = true
}

/**
 * Mark the current context as inside a transaction for the duration of
 * `fn`, restoring the previous value afterwards so nested transactions
 * unwind correctly.
 */
export async function withTransactionContext<T>(fn: () => Promise<T>): Promise<T> {
  const store = routingContext.getStore()
  if (!store)
    return fn()

  const previous = store.inTransaction
  store.inTransaction = true
  try {
    return await fn()
  }
  finally {
    store.inTransaction = previous
  }
}

/** Whether the current async context has already issued a write. */
export function contextHasWritten(): boolean {
  return routingContext.getStore()?.wroteInContext ?? false
}

/** Whether the current async context is inside a transaction. */
export function contextInTransaction(): boolean {
  return routingContext.getStore()?.inTransaction ?? false
}

/**
 * Whether a read issued right now may go to a replica.
 *
 * The single decision point for rules 1-3. Exported so the routing
 * behavior can be asserted directly in tests without standing up two
 * database servers.
 */
export function shouldRouteToReplica(options: {
  policy?: ReadPolicyConfig
  replicas?: ReplicaConfig[]
}): boolean {
  const { policy, replicas } = options

  if (!replicas?.length)
    return false
  if (!policy?.autoRoute)
    return false
  // Rule 2: a transaction's statements belong on one connection.
  if (contextInTransaction())
    return false
  // Rule 3: read-your-writes within the context that wrote.
  if (contextHasWritten())
    return false

  return true
}

/**
 * Round-robin cursor.
 *
 * Process-wide rather than per-context: the point is to spread load across
 * replicas, and a per-request counter would start at 0 every time and send
 * every first read of every request to the same replica.
 */
let roundRobinCursor = 0

/** Reset the cursor. Test-only — keeps selection assertions deterministic. */
export function resetReplicaCursor(): void {
  roundRobinCursor = 0
}

/**
 * Pick a replica according to the configured strategy.
 *
 * Returns `undefined` for an empty list so callers fall back to the
 * primary rather than having to pre-check.
 */
export function selectReplica(
  replicas: ReplicaConfig[],
  strategy: ReadPolicyConfig['strategy'] = 'round-robin',
  // Injectable so the `random` strategy is testable without stubbing globals.
  random: () => number = Math.random,
): ReplicaConfig | undefined {
  if (!replicas.length)
    return undefined
  if (replicas.length === 1)
    return replicas[0]

  if (strategy === 'random')
    return replicas[Math.floor(random() * replicas.length)]

  if (strategy === 'weighted') {
    // A replica with no explicit weight counts as 1, so a partially
    // weighted list still behaves sensibly instead of dropping members.
    const weights = replicas.map(r => Math.max(0, r.weight ?? 1))
    const total = weights.reduce((sum, w) => sum + w, 0)
    // Every weight explicitly zero: no replica is eligible, so fall back to
    // even distribution rather than returning nothing and silently sending
    // all reads to the primary.
    if (total <= 0)
      return replicas[roundRobinCursor++ % replicas.length]

    let ticket = random() * total
    for (let i = 0; i < replicas.length; i++) {
      ticket -= weights[i] as number
      if (ticket < 0)
        return replicas[i]
    }
    return replicas[replicas.length - 1]
  }

  return replicas[roundRobinCursor++ % replicas.length]
}

/**
 * Resolve a replica's connection settings against its primary.
 *
 * A replica declares only what differs — usually just the host — so
 * everything else is inherited. Getting this wrong in the other direction
 * (requiring full credentials per replica) is how host lists drift out of
 * sync with a rotated password.
 */
export function resolveReplicaConnection(
  replica: ReplicaConfig,
  primary: { name?: string, database?: string, host?: string, port?: number, username?: string, password?: string },
): { database: string, host: string, port?: number, username?: string, password?: string } {
  return {
    database: primary.name ?? primary.database ?? '',
    host: replica.host,
    port: replica.port ?? primary.port,
    username: replica.username ?? primary.username,
    password: replica.password ?? primary.password,
  }
}
