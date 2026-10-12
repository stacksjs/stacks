/**
 * Does the ordering warning actually reach the operator? (stacksjs/stacks#2896)
 *
 * The decision is pure and unit-tested; this is the wiring. It runs the real
 * guarantee against two equally empty sqlite databases, once for a table the
 * corpus creates after reading it and once for a table nobody else declared,
 * so the caller can count how many times the warning was printed.
 */
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { migrateNotificationTables } from '../../src/notification-tables'
import { ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection } from '../../src/utils'

await ensureDatabaseConfigLoaded()
const directory = mkdtempSync(join(tmpdir(), 'stacks-notification-ordering-'))

function configure(name: string): void {
  initializeDbConfig({
    app: { env: 'production' },
    database: {
      default: 'sqlite',
      connections: { sqlite: { database: join(directory, name) } },
      queryLogging: { enabled: false },
    },
  })
}

try {
  // The corpus creates this table itself, but reads it before creating it, so
  // the framework has to create it first and the application's shape loses.
  resetDatabaseConnection()
  configure('owned-by-corpus.sqlite')
  const owned = await migrateNotificationTables({
    tables: [{ table: 'notification_deliveries', reason: 'referenced-before-create' }],
  })
  assert.equal(owned.success, true)

  // The same call against the same database, which now has the table. The
  // shape comparison runs this time and finds nothing missing, because the
  // framework's columns are the ones standing. A warning here would be a false
  // positive on every migrate after the first, which is why the warning lives
  // in the branch where the table is absent.
  const replayed = await migrateNotificationTables({
    tables: [{ table: 'notification_deliveries', reason: 'referenced-before-create' }],
  })
  assert.equal(replayed.success, true)

  // The same create against a database just as empty, for a table nobody else
  // declared. Routine, and it has to stay quiet.
  resetDatabaseConnection()
  configure('owned-by-framework.sqlite')
  const framework = await migrateNotificationTables({ tables: ['notification_deliveries'] })
  assert.equal(framework.success, true)

  console.log('notification-ordering-warning-ok')
}
finally {
  resetDatabaseConnection()
  rmSync(directory, { recursive: true, force: true })
}
