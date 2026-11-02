import { assertSqlIdentifier, getDatabaseDialect, sqlHelpers } from '@stacksjs/database/runtime'

export interface QueueStateConnection {
  unsafe: (query: string, params?: unknown[]) => PromiseLike<Record<string, unknown>[]>
}

/** Seed a unique state row without aborting a PostgreSQL transaction on a race. */
export async function seedStateRow(
  connection: QueueStateConnection,
  table: 'queue_circuit_state' | 'job_quarantine' | 'scheduled_job_runs',
  keys: readonly string[],
  values: Record<string, string | number | null>,
): Promise<void> {
  const dialect = sqlHelpers(getDatabaseDialect())
  const quote = (name: string): string => {
    assertSqlIdentifier(name)
    return dialect.isMysql ? `\`${name}\`` : `"${name}"`
  }
  const columns = Object.keys(values)
  const conflict = dialect.isMysql
    ? `ON DUPLICATE KEY UPDATE ${quote(keys[0]!)} = ${quote(keys[0]!)}`
    : `ON CONFLICT (${keys.map(quote).join(', ')}) DO NOTHING`
  await connection.unsafe(
    `INSERT INTO ${quote(table)} (${columns.map(quote).join(', ')}) VALUES (${columns.map((_, index) => dialect.param(index + 1)).join(', ')}) ${conflict}`,
    Object.values(values),
  )
}
