import process from 'node:process'
import { ensureUtcDatetimeColumns, generateMigrations, migrateAuthTables, migrateNotificationTables, migrateRbacTables, migrateTraitTables, resetDatabase, runDatabaseMigration } from '@stacksjs/database'
import { log } from '@stacksjs/logging'

// First, reset the database
const resetResult = await resetDatabase()

if ((resetResult)?.isErr) {
  console.error((resetResult).error)
  await log.error('resetDatabase failed', (resetResult).error)
  process.exit(1)
}

// Then generate fresh migrations
const genResult = await generateMigrations()

if ((genResult)?.isErr) {
  console.error((genResult).error)
  await log.error('generateMigrations failed', (genResult).error)
  process.exit(1)
}

// Recreate auth/OAuth tables before the numbered model migrations run.
// `resetDatabase()` above just dropped them, and at least one numbered migration
// (0000000098-revoke-legacy-long-lived-tokens.sql) writes to
// oauth_access_tokens/oauth_refresh_tokens directly — it needs those tables
// to already exist.
const authResult = await migrateAuthTables()
if (!authResult.success)
  log.error(`Failed to migrate auth tables: ${authResult.error}`)

// No notification bootstrap here. `runDatabaseMigration()` below already does
// it, and does it corpus-aware: it reads the committed migrations and
// pre-creates only the notification tables the corpus does not declare itself,
// so a model-owned CREATE stays authoritative over its own shape.
//
// This step used to pre-create `notifications` and `notification_deliveries`
// unconditionally, a few lines before that. In an app that overrides
// `NotificationDelivery` to add columns, the framework's narrower table was
// therefore already standing when the corpus reached its own
// `CREATE TABLE IF NOT EXISTS`, which then succeeded as a silent no-op, and the
// first index on an app-only column failed with "column does not exist"
// (stacksjs/stacks#2894). Nothing reported the shape: the guarantee's own check
// compares against the framework's REQUIRED_COLUMNS, which the narrow table
// satisfies, so an app whose extra columns are not indexed got a quietly wrong
// table instead of an error.
//
// Deleting it strands nothing. Where the corpus has no CREATE for these tables
// - this framework checkout included, where migrations 133 and 134 update and
// rebuild `notification_deliveries` without ever creating it - the corpus-aware
// pass pre-creates them anyway, and it covers all three tables rather than two.

// Then migrate the model-owned database schema.
const migrateResult = await runDatabaseMigration()

// Notification and RBAC guarantees must run after model migrations. An app
// may own one of these tables (notably `notification_preferences`); creating
// the framework fallback first makes CREATE TABLE IF NOT EXISTS suppress the
// model-defined constraints. Still attempt the guarantees before surfacing a
// model migration failure so partial/legacy databases remain repairable.
const notifResult = await migrateNotificationTables()
if (!notifResult.success)
  log.error(`Failed to migrate notification tables: ${notifResult.error}`)

const rbacResult = await migrateRbacTables()
if (!rbacResult.success)
  log.error(`Failed to migrate RBAC tables: ${rbacResult.error}`)

const traitResult = await migrateTraitTables()
if (!traitResult.success)
  log.error(`Failed to migrate polymorphic trait tables: ${traitResult.error}`)

const datetimeResult = await ensureUtcDatetimeColumns()
if (!datetimeResult.success)
  log.error(`Failed to convert TIMESTAMP columns to DATETIME: ${datetimeResult.error}`)

if ((migrateResult).isErr) {
  await log.error('runDatabaseMigration failed')
  await log.error((migrateResult).error)
  process.exit(1)
}

process.exit(0)
