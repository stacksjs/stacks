/**
 * Augment `@stacksjs/database`'s `DatabaseSchema` with the tables the
 * notifications package owns (stacksjs/stacks#1923 / Notif-3 follow-up
 * to #1937). These two tables are framework-shipped via
 * `migrateNotificationTables()`, so they're stable parts of the schema
 * — declaring them here gives `db.selectFrom('notifications')` and
 * column-name autocomplete + lets us drop the per-call `as any` casts
 * in `drivers/database.ts` and `preferences.ts`.
 *
 * Column names match the DDL emitted by
 * `notificationsTableSql()` / `notificationPreferencesTableSql()`.
 */

declare module '@stacksjs/database' {
  interface DatabaseSchema {
    notifications: {
      id: number
      user_id: number
      type: string
      data: string
      read_at: string | null
      created_at: string
      updated_at: string | null
    }
    notification_preferences: {
      id: number
      user_id: number
      channel: string
      enabled: boolean
      category: string | null
      created_at: string
      updated_at: string | null
    }
  }
}

export {}
