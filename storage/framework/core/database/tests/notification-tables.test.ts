import { describe, expect, test } from 'bun:test'
import {
  migrateNotificationTables,
  notificationPreferencesTableSql,
  notificationsTableSql,
} from '../src/notification-tables'
import { sqlHelpers } from '../src/sql-helpers'

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
  })

  for (const driver of ['sqlite', 'mysql', 'postgres'] as const) {
    describe(driver, () => {
      const sql = sqlHelpers(driver)

      test('notifications table has the columns the database channel writes', () => {
        const ddl = notificationsTableSql(sql)
        expect(ddl).toContain('CREATE TABLE IF NOT EXISTS notifications')
        for (const col of ['user_id', 'type', 'data', 'read_at', 'created_at', 'updated_at'])
          expect(ddl).toContain(col)
      })

      test('notification_preferences carries the UNIQUE(user_id, channel, category) guard', () => {
        const ddl = notificationPreferencesTableSql(sql)
        expect(ddl).toContain('CREATE TABLE IF NOT EXISTS notification_preferences')
        expect(ddl).toContain('channel')
        expect(ddl).toContain('enabled')
        expect(ddl).toContain('UNIQUE (user_id, channel, category)')
      })

      test('primary-key DDL matches the dialect', () => {
        const ddl = notificationsTableSql(sql)
        // pkColumn from sqlHelpers is dialect-specific; just assert it's present.
        expect(ddl).toContain(sql.pkColumn)
      })
    })
  }

  test('sqlite uses AUTOINCREMENT, mysql uses AUTO_INCREMENT', () => {
    expect(notificationsTableSql(sqlHelpers('sqlite'))).toContain('AUTOINCREMENT')
    expect(notificationsTableSql(sqlHelpers('mysql'))).toContain('AUTO_INCREMENT')
  })
})
