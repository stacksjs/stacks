/**
 * Loud detection of Bun SQL pools broken by oven-sh/bun#42804. Detection
 * only: nothing here retries, repairs or replaces a pool.
 *
 * When PostgreSQL ends a connection while Bun's pool is still opening it, Bun
 * 1.4.1 can put that pool slot back into its connected state with no native
 * connection behind it (robobun's analysis on the issue). From then on every
 * query the pool routes to the slot rejects at once with a plain `Error` whose
 * message is exactly `connection must be a PostgresSQLConnection` and which
 * carries no `code`, and the pool's close() was still pending 2 seconds later
 * in local runs. The upstream fix is oven-sh/bun#40913, open and unmerged at
 * the time of writing.
 *
 * A broken pool is not expected to recover. In a local reproduction Bun
 * rejected all 31 queries sent to one over 30 seconds and opened no new
 * connection in that time, so a pool recorded here stays recorded until the
 * process exits. Restarting the process is the remedy, and making that
 * visible is the point: one error line per pool, and a record a health check
 * can read (`getBrokenDatabasePools`).
 *
 * The message is Bun's generic guard, not unique to #42804: a raw reserved
 * connection used after reserved.close() rejects the same way. That case could
 * not be reached through Stacks' own query paths locally (a reserved builder's
 * close() hangs instead), so a match is read as #42804.
 *
 * MySQL is matched too, from Bun's source, and was not reproduced locally.
 * Bun's MySQL query runner has the same guard as the Postgres one
 * (`connection must be a MySQLConnection`, thrown the same way, in
 * src/sql_jsc/mysql/JSMySQLQuery.rs at bun-v1.4.1), and oven-sh/bun#40913
 * changes Bun's MySQL connection code for the same ordering bug. Killing a
 * MySQL 8.4 pool's sessions while it opened them produced the message in none
 * of 160 local trials.
 */

/** The exact message Bun's Postgres adapter rejects with for a broken slot. */
export const BUN_BROKEN_POSTGRES_POOL_MESSAGE = 'connection must be a PostgresSQLConnection'

/** The same guard in Bun's MySQL adapter, matched from Bun's source (see above). */
export const BUN_BROKEN_MYSQL_POOL_MESSAGE = 'connection must be a MySQLConnection'

const BROKEN_POOL_MESSAGES: ReadonlySet<unknown> = new Set([BUN_BROKEN_POSTGRES_POOL_MESSAGE, BUN_BROKEN_MYSQL_POOL_MESSAGE])

/** Which pool, without credentials. */
export interface DatabasePoolIdentity {
  driver: string
  host: string
  port?: number
  database: string
}

export interface BrokenDatabasePool extends DatabasePoolIdentity {
  /** When the first matching error was seen, in epoch milliseconds. */
  detectedAt: number
}

export interface BrokenPoolDetector {
  /** Record `error` against `pool` if it is Bun's broken-slot error. True when this call recorded the pool. */
  record: (error: unknown, pool: DatabasePoolIdentity) => boolean
  pools: () => BrokenDatabasePool[]
}

/**
 * Exact match rather than `includes`: each message is Bun's own, thrown by one
 * guard, and nothing that merely quotes it is the same failure.
 */
export function isBrokenBunPoolError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && BROKEN_POOL_MESSAGES.has((error as { message?: unknown }).message)
}

export function describeDatabasePool(pool: DatabasePoolIdentity): string {
  return `${pool.driver} ${pool.host}${pool.port ? `:${pool.port}` : ''}/${pool.database}`
}

export function createBrokenPoolDetector(options: { log?: (line: string) => void, now?: () => number } = {}): BrokenPoolDetector {
  // console.error rather than the async logger: it is written before this
  // returns, from inside a query hook that must stay synchronous.
  const log = options.log ?? ((line: string) => console.error(line))
  const now = options.now ?? Date.now
  const broken = new Map<string, BrokenDatabasePool>()
  // One error can reach this twice, from a replica builder's own hook and then
  // the process-wide one it forwards to. The first, more specific pool wins.
  const attributed = new WeakSet<object>()

  return {
    record(error, pool) {
      if (!isBrokenBunPoolError(error) || attributed.has(error as object))
        return false
      attributed.add(error as object)

      const key = describeDatabasePool(pool)
      if (broken.has(key))
        return false
      broken.set(key, { ...pool, detectedAt: now() })

      log(`[database] oven-sh/bun#42804: a connection in the Bun SQL pool for ${key} rejected a query with "${(error as Error).message}". Bun is not expected to recover it, so queries routed to it can keep failing until this process restarts. Stacks does not repair or replace the pool; restart the process.`)
      return true
    },
    pools: () => [...broken.values()],
  }
}

const detector = createBrokenPoolDetector()

/** Record a query error from `pool`. Anything but Bun's broken-slot error is ignored. */
export function recordDatabaseQueryError(error: unknown, pool: DatabasePoolIdentity): boolean {
  return detector.record(error, pool)
}

/** Every pool this process has seen broken. Empty until one is; never shrinks. */
export function getBrokenDatabasePools(): BrokenDatabasePool[] {
  return detector.pools()
}
