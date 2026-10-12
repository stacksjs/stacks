import { describe, expect, test } from 'bun:test'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  migrateNotificationTables,
  notificationDeliveriesTableSql,
  notificationPreferencesTableSql,
  notificationTablePreflight,
  notificationsTableSql,
  preflightShapeWarning,
} from '../src/notification-tables'
import { sqlHelpers } from '../src/sql-helpers'
import { indexSqlForDialect, isDuplicateIndexError } from '../src/dialect'

/**
 * Notification tables migration (stacksjs/stacks#1937).
 *
 * The DDL builders are pure, so we assert the generated SQL per dialect
 * without needing a live connection (which the auth-tables pattern this
 * mirrors leaves to integration). `migrateNotificationTables` is the
 * thin executor over these builders, wired into `buddy migrate`.
 */

describe('notification table DDL - cross-dialect (stacksjs/stacks#1937)', () => {
  test('exports the migrator + pure builders', () => {
    expect(typeof migrateNotificationTables).toBe('function')
    expect(typeof notificationsTableSql).toBe('function')
    expect(typeof notificationPreferencesTableSql).toBe('function')
    expect(typeof notificationDeliveriesTableSql).toBe('function')
  })

  for (const driver of ['sqlite', 'mysql', 'postgres'] as const) {
    describe(driver, () => {
      const sql = sqlHelpers(driver)

      test('notifications table has the columns the database channel writes', () => {
        const ddl = notificationsTableSql(sql)
        expect(ddl).toContain('CREATE TABLE IF NOT EXISTS notifications')
        for (const col of ['user_id', 'type', 'data', 'read_at', 'uuid', 'created_at', 'updated_at'])
          expect(ddl).toContain(col)
      })

      test('notification_preferences carries the UNIQUE(user_id, channel, category) guard', () => {
        const ddl = notificationPreferencesTableSql(sql)
        expect(ddl).toContain('CREATE TABLE IF NOT EXISTS notification_preferences')
        expect(ddl).toContain('channel')
        expect(ddl).toContain('enabled')
        expect(ddl).toContain('UNIQUE (user_id, channel, category)')
      })

      test('notification_deliveries tracks transport attempts separately from the inbox', () => {
        const ddl = notificationDeliveriesTableSql(sql)
        expect(ddl).toContain('CREATE TABLE IF NOT EXISTS notification_deliveries')
        for (const col of ['user_id', 'channel', 'recipient', 'subject', 'body', 'status', 'error', 'metadata', 'sent_at'])
          expect(ddl).toContain(col)
      })

      test('primary-key DDL matches the dialect', () => {
        const ddl = notificationsTableSql(sql)
        expect(ddl).toContain(sql.bigPkColumn)
      })
    })
  }

  test('sqlite uses AUTOINCREMENT, mysql uses AUTO_INCREMENT', () => {
    expect(notificationsTableSql(sqlHelpers('sqlite'))).toContain('AUTOINCREMENT')
    expect(notificationsTableSql(sqlHelpers('mysql'))).toContain('AUTO_INCREMENT')
  })

  test('model-owned tables use the same wide storage as generated migrations', () => {
    const mysql = sqlHelpers('mysql')
    expect(notificationsTableSql(mysql)).toContain('id BIGINT PRIMARY KEY AUTO_INCREMENT')
    expect(notificationsTableSql(mysql)).toContain('user_id BIGINT,')
    expect(notificationsTableSql(mysql)).toContain('data TEXT NOT NULL')
    expect(notificationDeliveriesTableSql(mysql)).toContain('id BIGINT PRIMARY KEY AUTO_INCREMENT')
    expect(notificationDeliveriesTableSql(mysql)).toContain('recipient TEXT NOT NULL')
  })

  test('runtime indexes use valid idempotency for MySQL-wire dialects', () => {
    const statement = '\n      CREATE UNIQUE INDEX IF NOT EXISTS notifications_uuid_unique ON notifications(uuid)'
    expect(indexSqlForDialect(statement, 'sqlite')).toContain('IF NOT EXISTS')
    expect(indexSqlForDialect(statement, 'postgres')).toContain('IF NOT EXISTS')
    expect(indexSqlForDialect(statement, 'mysql')).not.toContain('IF NOT EXISTS')
    expect(indexSqlForDialect(statement, 'vitess')).not.toContain('IF NOT EXISTS')
    expect(isDuplicateIndexError(new Error("Duplicate key name 'notifications_uuid_unique'"))).toBe(true)
    expect(isDuplicateIndexError(new Error('connection refused'))).toBe(false)
  })

  test('preflights legacy corpora that reference tables without creating them', () => {
    const sql = `
      CREATE TABLE "_qb_tmp_notifications" ("id" INTEGER PRIMARY KEY);
      INSERT INTO "_qb_tmp_notifications" SELECT "id" FROM "notifications";
      UPDATE notification_deliveries SET user_id = NULL;
    `

    expect(notificationTablePreflight(sql)).toEqual([
      { table: 'notifications', reason: 'no-create-statement' },
      { table: 'notification_preferences', reason: 'no-create-statement' },
      { table: 'notification_deliveries', reason: 'no-create-statement' },
    ])
  })

  test('leaves model-owned notification table creates authoritative', () => {
    const sql = `
      CREATE TABLE IF NOT EXISTS "notifications" ("id" INTEGER PRIMARY KEY, "user_id" INTEGER REFERENCES "users"("id"));
      CREATE TABLE \`notification_deliveries\` (\`id\` BIGINT PRIMARY KEY, \`user_id\` BIGINT);
    `

    expect(notificationTablePreflight(sql)).toEqual([
      { table: 'notification_preferences', reason: 'no-create-statement' },
    ])
  })

  test('tells a table referenced before its own create apart from one the corpus never creates', () => {
    const sql = `
      UPDATE notification_deliveries SET user_id = NULL;
      CREATE TABLE "notification_deliveries" ("id" INTEGER PRIMARY KEY, "user_id" INTEGER);
    `

    /*
     * All three still have to be created before the batch runs, which is why
     * the old names-only return value could not distinguish them. Only the
     * third has a shape of its own that the framework's create is about to
     * shadow, and that distinction is the whole of stacksjs/stacks#2896: it is
     * knowable here, from the corpus, and nowhere downstream.
     */
    expect(notificationTablePreflight(sql)).toEqual([
      { table: 'notifications', reason: 'no-create-statement' },
      { table: 'notification_preferences', reason: 'no-create-statement' },
      { table: 'notification_deliveries', reason: 'referenced-before-create' },
    ])
  })
})

/**
 * The warning an application gets when its own CREATE cannot win.
 *
 * `warnOnShapeMismatch` compares the live table against the framework's
 * REQUIRED_COLUMNS, and the framework's own table satisfies those by
 * construction, so no column an application adds can ever come back missing.
 * An app that overrode `NotificationDelivery` therefore got a quietly narrow
 * table and a migrate that reported success. The reason recorded by
 * `notificationTablePreflight` is what closes that, because it is read off the
 * corpus, where the application's shape is still visible.
 */
describe('preflightShapeWarning (stacksjs/stacks#2896)', () => {
  test('names the table, the no-op and the symptom when the corpus owns the shape', () => {
    const warning = preflightShapeWarning({ table: 'notification_deliveries', reason: 'referenced-before-create' })

    expect(warning).toContain('"notification_deliveries"')
    expect(warning).toContain('created by your own migrations')
    expect(warning).toContain('CREATE TABLE IF NOT EXISTS')
    expect(warning).toContain('column does not exist')
  })

  test('says nothing about a table the framework owns outright', () => {
    // The ordinary preflight. The corpus has no create for this table, so the
    // framework's shape is the only shape anyone declared.
    expect(preflightShapeWarning({ table: 'notifications', reason: 'no-create-statement' })).toBeNull()
  })

  test('stays silent on the framework corpus, which creates none of these tables', () => {
    const root = new URL('../../../../../', import.meta.url).pathname
    const dir = join(root, 'database/migrations')
    const corpus = readdirSync(dir)
      .filter(file => file.endsWith('.sql'))
      .sort()
      .map(file => readFileSync(join(dir, file), 'utf8'))
      .join('\n')

    // Measured rather than assumed: all three are `no-create-statement` here,
    // so a stock application sees the preflight and no warning. Should this go
    // red, the generated corpus has started creating a notification table
    // after reading it and the framework is now warning at itself.
    const noisy = notificationTablePreflight(corpus).filter(entry => preflightShapeWarning(entry) !== null)

    expect(noisy, 'the framework corpus now trips its own ordering warning').toEqual([])
  })
})

/**
 * The foreign keys, and why they need a second pass.
 *
 * A legacy corpus may need selected framework tables before its model batch,
 * while a corpus with its own CREATE statements must keep those model-owned
 * schemas authoritative. Either way, the foreign-key pass runs after `users`
 * exists and can safely repair preflighted tables on supported dialects.
 */
describe('ensureNotificationForeignKeys', () => {
  test('is exported, so the migration runner can call it after the batch', async () => {
    const { ensureNotificationForeignKeys } = await import('../src/notification-tables')

    expect(typeof ensureNotificationForeignKeys).toBe('function')
  })

  test('is a no-op rather than a throw when there is no database to reach', async () => {
    const { ensureNotificationForeignKeys } = await import('../src/notification-tables')

    /*
     * Every statement is swallowed individually, because an installation that
     * has deliberately dropped the relation - or has no `users` table at all -
     * must not fail its migration over a constraint it does not want. The
     * per-statement scope matters too: a drop that finds nothing must not skip
     * the add that follows it.
     */
    await expect(ensureNotificationForeignKeys()).resolves.toBeUndefined()
  })
})
