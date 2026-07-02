import process from 'node:process'
import { generateMigrations, migrateAuthTables, migrateNotificationTables, migrateRbacTables, resetDatabase, runDatabaseMigration } from '@stacksjs/database'
import { log } from '@stacksjs/logging'

// First, reset the database
const resetResult = await resetDatabase()

if ((resetResult as any)?.isErr) {
  console.error((resetResult as any).error)
  log.error('resetDatabase failed', (resetResult as any).error)
  process.exit(1)
}

// Then generate fresh migrations
const genResult = await generateMigrations()

if ((genResult as any)?.isErr) {
  console.error((genResult as any).error)
  log.error('generateMigrations failed', (genResult as any).error)
  process.exit(1)
}

// Recreate the framework tables (oauth, notifications, RBAC) before the
// numbered model migrations run. `resetDatabase()` above just dropped them,
// and at least one numbered migration
// (0000000098-revoke-legacy-long-lived-tokens.sql) writes to
// oauth_access_tokens/oauth_refresh_tokens directly — it needs those tables
// to already exist. This mirrors the ordering fix in the `buddy migrate`
// command; the SQL here is idempotent `CREATE TABLE IF NOT EXISTS`.
const authResult = await migrateAuthTables()
if (!authResult.success)
  log.error(`Failed to migrate auth tables: ${authResult.error}`)

const notifResult = await migrateNotificationTables()
if (!notifResult.success)
  log.error(`Failed to migrate notification tables: ${notifResult.error}`)

const rbacResult = await migrateRbacTables()
if (!rbacResult.success)
  log.error(`Failed to migrate RBAC tables: ${rbacResult.error}`)

// Finally, migrate the database
const migrateResult = await runDatabaseMigration()

if ((migrateResult as any).isErr) {
  log.error('runDatabaseMigration failed')
  log.error((migrateResult as any).error)
  process.exit(1)
}

process.exit(0)
