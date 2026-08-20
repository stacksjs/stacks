import { describe, expect, test } from 'bun:test'
import {
  migrateNotificationTables,
  notificationDeliveriesTableSql,
  notificationPreferencesTableSql,
  notificationTablesMissingCreateStatements,
  notificationsTableSql,
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

    expect(notificationTablesMissingCreateStatements(sql)).toEqual([
      'notifications',
      'notification_preferences',
      'notification_deliveries',
    ])
  })

  test('leaves model-owned notification table creates authoritative', () => {
    const sql = `
      CREATE TABLE IF NOT EXISTS "notifications" ("id" INTEGER PRIMARY KEY, "user_id" INTEGER REFERENCES "users"("id"));
      CREATE TABLE \`notification_deliveries\` (\`id\` BIGINT PRIMARY KEY, \`user_id\` BIGINT);
    `

    expect(notificationTablesMissingCreateStatements(sql)).toEqual(['notification_preferences'])
  })

  test('preflights a notification table referenced before its generated create', () => {
    const sql = `
      UPDATE notification_deliveries SET user_id = NULL;
      CREATE TABLE "notification_deliveries" ("id" INTEGER PRIMARY KEY, "user_id" INTEGER);
    `

    expect(notificationTablesMissingCreateStatements(sql)).toEqual([
      'notifications',
      'notification_preferences',
      'notification_deliveries',
    ])
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
