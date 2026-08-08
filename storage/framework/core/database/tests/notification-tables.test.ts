import { describe, expect, test } from 'bun:test'
import {
  migrateNotificationTables,
  notificationDeliveriesTableSql,
  notificationPreferencesTableSql,
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

describe('notification table DDL — cross-dialect (stacksjs/stacks#1937)', () => {
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
})

/**
 * The foreign keys, and why they need a second pass.
 *
 * `migrateNotificationTables` runs *before* the model migration batch on
 * purpose - a generated model migration may normalize or rebuild these tables
 * and needs them to exist first. That ordering is also why the keys never
 * landed: the guarantee created `notifications` without them, and the model's
 * own `CREATE TABLE IF NOT EXISTS … REFERENCES users(id) ON DELETE CASCADE`
 * became a no-op against a table that already existed.
 *
 * The migration ran, the corpus declared the key, and the key was not there -
 * which is the shape that made it survive a tick on somebody's roadmap.
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
