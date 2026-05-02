import { log } from '@stacksjs/logging'
import { database } from '@stacksjs/config'
import { path } from '@stacksjs/path'
// Same leaf-import strategy as the other custom migrations — going through
// the drivers barrel pulls in every driver and its load cycle.
import { hasTableBeenMigrated } from '../drivers/helpers'

/**
 * Create the `model_audits` table used by the `useAudit` ORM trait.
 *
 * The trait writes one row per create/update/delete on any model that
 * declares `traits: { useAudit: true }`. The schema is intentionally
 * polymorphic — `auditable_type` + `auditable_id` rather than per-table
 * audit columns — so adding the trait to a new model never requires a
 * follow-up migration.
 *
 * @example
 * ```ts
 * import { createModelAuditsTable } from '@stacksjs/database'
 * await createModelAuditsTable() // idempotent — checks before writing
 * ```
 */
export async function createModelAuditsTable(): Promise<void> {
  if (!['sqlite', 'mysql'].includes(getDriver())) return

  const hasBeenMigrated = await hasTableBeenMigrated('model_audits')
  if (hasBeenMigrated) return

  let migrationContent = `import type { Database } from '@stacksjs/database'\nimport { sql } from '@stacksjs/database'\n\n`
  migrationContent += `export async function up(db: Database<any>) {\n`
  migrationContent += `  await db.schema\n`
  migrationContent += `    .createTable('model_audits')\n`
  migrationContent += `    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())\n`
  // The model class name (e.g. 'User', 'Post'). Pairs with `auditable_id`
  // for the polymorphic foreign-key lookup in `Model.audits(id)`.
  migrationContent += `    .addColumn('auditable_type', 'varchar(255)', col => col.notNull())\n`
  // Stored as text rather than int so non-integer primary keys (uuids,
  // string slugs) are supported without a schema change.
  migrationContent += `    .addColumn('auditable_id', 'varchar(255)', col => col.notNull())\n`
  // 'created' | 'updated' | 'deleted' — kept narrow on purpose; if more
  // events are ever added the trait can expand the enum independently.
  migrationContent += `    .addColumn('event', 'varchar(32)', col => col.notNull())\n`
  // JSON-encoded snapshots. Old can be null on create; new can be null
  // on delete.
  migrationContent += `    .addColumn('old_values', 'text')\n`
  migrationContent += `    .addColumn('new_values', 'text')\n`
  // Nullable: CLI / cron / queue jobs without a current request emit
  // audits with no associated user.
  migrationContent += `    .addColumn('user_id', 'integer')\n`
  migrationContent += `    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))\n`
  migrationContent += `    .execute()\n\n`

  // Composite index for the common query: "show me the audit trail for
  // this specific row, newest first". Matches `Model.audits(id)`.
  migrationContent += `  await db.schema\n`
  migrationContent += `    .createIndex('idx_model_audits_lookup')\n`
  migrationContent += `    .on('model_audits')\n`
  migrationContent += `    .columns(['auditable_type', 'auditable_id', 'created_at'])\n`
  migrationContent += `    .execute()\n`
  migrationContent += `}\n`

  const timestamp = new Date().getTime().toString()
  const migrationFileName = `${timestamp}-create-model-audits-table.ts`
  const migrationFilePath = path.userMigrationsPath(migrationFileName)

  await Bun.write(migrationFilePath, migrationContent)

  log.success('Created model_audits table migration')
}

function getDriver(): string {
  return database.default || ''
}
