/**
 * The DDL passes follow the configured driver, not `DB_CONNECTION`
 * (stacksjs/stacks#2897).
 *
 * Spawned with `DB_CONNECTION=postgres` and configured for sqlite, which is
 * the disagreement an application creates by configuring a driver its `.env`
 * does not name. Every pass below renders DDL by hand and picks placeholders,
 * quoting, boolean literals and timestamp defaults per dialect, so each one
 * used to emit postgres DDL at the sqlite file it had just been pointed at and
 * fail on `near "AT": syntax error` from `AT TIME ZONE`.
 */
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolvedDatabaseDriver } from '../../src/dialect'
import { migrateAuthTables } from '../../src/auth-tables'
import { migrateNotificationTables } from '../../src/notification-tables'
import { migrateRbacTables } from '../../src/rbac-tables'
import { migrateTraitTables } from '../../src/trait-tables'
import { ensureUtcDatetimeColumns } from '../../src/datetime-columns'
import { db, ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection } from '../../src/utils'

assert.equal(process.env.DB_CONNECTION, 'postgres', 'the fixture needs the disagreement it is testing')

await ensureDatabaseConfigLoaded()
const directory = mkdtempSync(join(tmpdir(), 'stacks-configured-dialect-'))

try {
  resetDatabaseConnection()
  initializeDbConfig({
    app: { env: 'production' },
    database: {
      default: 'sqlite',
      connections: { sqlite: { database: join(directory, 'app.sqlite') } },
      queryLogging: { enabled: false },
    },
  })

  // What every pass below asks before it renders anything.
  assert.equal(resolvedDatabaseDriver(), 'sqlite')

  assert.equal((await migrateAuthTables()).success, true, 'auth tables')
  assert.equal((await migrateNotificationTables()).success, true, 'notification tables')
  assert.equal((await migrateRbacTables()).success, true, 'RBAC tables')
  assert.equal((await migrateTraitTables()).success, true, 'trait tables')
  assert.equal((await ensureUtcDatetimeColumns()).success, true, 'UTC datetime columns')

  // Rendered for sqlite, so sqlite can describe them.
  const tables = (await db.unsafe(`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`).execute()) as Array<{ name: string }>
  const names = new Set(tables.map(row => row.name))
  for (const table of ['notifications', 'notification_deliveries', 'notification_preferences', 'roles', 'permissions'])
    assert(names.has(table), `missing ${table}: got ${[...names].join(', ')}`)

  console.log('configured-dialect-guarantees-ok')
}
finally {
  resetDatabaseConnection()
  rmSync(directory, { recursive: true, force: true })
}
