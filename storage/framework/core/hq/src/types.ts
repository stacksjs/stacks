/**
 * Where an account stands against one meter.
 *
 * - `ok`: under 80% of the allowance
 * - `warn`: at or past 80%, still inside it
 * - `over`: the allowance is used up; the grace is being spent (or, for a
 *   send, has run out)
 * - `sampled`: an ingest meter past its grace, keeping one event in ten
 */
export type UsageState = 'ok' | 'warn' | 'over' | 'sampled'

/** One row of `GET /api/v1/usage`, and what a reader hands an app. */
export interface UsageReport {
  meter: string
  used: number
  /** `null` is an unlimited meter. */
  limit: number | null
  /** `YYYY-MM`, UTC. */
  period: string
  state: UsageState
  upgradeUrl: string
}

export type SqlDialect = 'sqlite' | 'mysql' | 'postgres'

/**
 * The slice of a database client this package needs. `db` from
 * `@stacksjs/database` satisfies it; so does anything else that can run a
 * parameterised statement, which is what keeps this package free of a
 * database dependency.
 */
export interface SqlClient {
  unsafe: (sql: string, params?: unknown[]) => unknown
}
