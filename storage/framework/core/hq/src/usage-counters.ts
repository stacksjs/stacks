import type { CounterKey, CounterStore } from './counter'
import type { SqlClient, SqlDialect } from './types'
import { placeholder, runSql, tableName } from './sql'

export const USAGE_COUNTERS_TABLE = 'usage_counters'

export interface UsageCountersSchemaOptions {
  table?: string
  dialect?: SqlDialect
}

/**
 * The package-owned schema for `usage_counters`: one row per
 * (owner, meter, period), `used` as a whole number of units.
 *
 * Returned for a service to put in a migration, or to hand to
 * `ensureUsageCountersTable`. No migration file is written implicitly.
 */
export function usageCountersMigrationSql(options: UsageCountersSchemaOptions = {}): string[] {
  const table = tableName(options.table ?? USAGE_COUNTERS_TABLE)
  const dialect = options.dialect ?? 'sqlite'
  const timestamp = dialect === 'postgres' ? 'TIMESTAMPTZ' : dialect === 'mysql' ? 'TIMESTAMP' : 'DATETIME'

  return [
    `CREATE TABLE IF NOT EXISTS ${table} (`
    + 'owner VARCHAR(191) NOT NULL,'
    + 'meter VARCHAR(64) NOT NULL,'
    + 'period CHAR(7) NOT NULL,'
    + 'used BIGINT NOT NULL DEFAULT 0,'
    + `updated_at ${timestamp} DEFAULT CURRENT_TIMESTAMP,`
    + 'PRIMARY KEY (owner, meter, period)'
    + ')',
  ]
}

/** Explicitly provision the table using the package-owned schema. */
export async function ensureUsageCountersTable(client: SqlClient, options: UsageCountersSchemaOptions = {}): Promise<void> {
  for (const sql of usageCountersMigrationSql(options))
    await runSql(client, sql)
}

/**
 * A `CounterStore` over `usage_counters`.
 *
 * `add` is an upsert whose update is `used = used + delta`, computed by the
 * database. Any number of app instances therefore converge on one total
 * instead of overwriting each other, and the statement's answer is the new
 * total, so the counter never issues a separate read to learn where an
 * account stands.
 */
export function sqlCounterStore(client: SqlClient, options: UsageCountersSchemaOptions = {}): CounterStore {
  const table = tableName(options.table ?? USAGE_COUNTERS_TABLE)
  const dialect = options.dialect ?? 'sqlite'
  const p = (n: number): string => placeholder(dialect, n)
  const select = `SELECT used FROM ${table} WHERE owner = ${p(1)} AND meter = ${p(2)} AND period = ${p(3)} LIMIT 1`

  async function read(key: CounterKey): Promise<number> {
    const row = (await runSql(client, select, [key.owner, key.meter, key.period]))[0]
    return Number(row?.used ?? 0)
  }

  return {
    read,
    async add({ owner, meter, period, delta }) {
      const values = [owner, meter, period, delta]
      if (dialect === 'mysql') {
        // No RETURNING on MySQL, so the total costs a second statement.
        await runSql(
          client,
          `INSERT INTO ${table} (owner, meter, period, used, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP) `
          + 'ON DUPLICATE KEY UPDATE used = used + VALUES(used), updated_at = CURRENT_TIMESTAMP',
          values,
        )
        return read({ owner, meter, period })
      }
      const row = (await runSql(
        client,
        `INSERT INTO ${table} (owner, meter, period, used, updated_at) VALUES (${p(1)}, ${p(2)}, ${p(3)}, ${p(4)}, CURRENT_TIMESTAMP) `
        + `ON CONFLICT (owner, meter, period) DO UPDATE SET used = ${table}.used + EXCLUDED.used, updated_at = CURRENT_TIMESTAMP `
        + 'RETURNING used',
        values,
      ))[0]
      return row ? Number(row.used ?? 0) : null
    },
  }
}
