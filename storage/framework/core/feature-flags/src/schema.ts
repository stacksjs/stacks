import type { FeatureDatabaseClient } from './types'
import { FeatureFlagStoreError } from './errors'

export type FeatureFlagSqlDialect = 'sqlite' | 'mysql' | 'postgres'

export interface FeatureFlagSchemaOptions {
  table?: string
  dialect?: FeatureFlagSqlDialect
}

export function featureFlagTableName(table = 'feature_flags'): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(table))
    throw new FeatureFlagStoreError(`Invalid feature flag table name '${table}'.`)
  return table
}

/**
 * Return the package-owned schema for publishing or explicit provisioning.
 * No application migration file is written implicitly.
 */
export function featureFlagMigrationSql(options: FeatureFlagSchemaOptions = {}): string[] {
  const table = featureFlagTableName(options.table)
  const dialect = options.dialect ?? 'sqlite'

  if (dialect === 'mysql') {
    return [
      `CREATE TABLE IF NOT EXISTS ${table} (`
      + 'name VARCHAR(191) NOT NULL,'
      + 'scope VARCHAR(512) NOT NULL,'
      + 'value TEXT NOT NULL,'
      + 'created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,'
      + 'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,'
      + `UNIQUE KEY ${table}_name_scope_unique (name, scope),`
      + `KEY ${table}_scope_index (scope)`
      + ')',
    ]
  }

  const timestampType = dialect === 'postgres' ? 'TIMESTAMPTZ' : 'DATETIME'
  return [
    `CREATE TABLE IF NOT EXISTS ${table} (`
    + 'name VARCHAR(191) NOT NULL,'
    + 'scope VARCHAR(512) NOT NULL,'
    + 'value TEXT NOT NULL,'
    + `created_at ${timestampType} DEFAULT CURRENT_TIMESTAMP,`
    + `updated_at ${timestampType} DEFAULT CURRENT_TIMESTAMP,`
    + 'UNIQUE (name, scope)'
    + ')',
    `CREATE INDEX IF NOT EXISTS ${table}_scope_index ON ${table}(scope)`,
  ]
}

async function executeUnsafe(database: FeatureDatabaseClient, sql: string): Promise<void> {
  if (!database.unsafe)
    throw new FeatureFlagStoreError('The database client does not support schema provisioning via unsafe SQL.')
  const statement = database.unsafe(sql)
  if (statement && typeof statement.execute === 'function') await statement.execute()
  else await statement
}

/** Explicitly provision the feature flag table using the package-owned schema. */
export async function ensureFeatureFlagTable(
  database: FeatureDatabaseClient,
  options: FeatureFlagSchemaOptions = {},
): Promise<void> {
  for (const sql of featureFlagMigrationSql(options)) await executeUnsafe(database, sql)
}
