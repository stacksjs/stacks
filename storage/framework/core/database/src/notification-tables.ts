/**
 * Notification Tables Migration (stacksjs/stacks#1937)
 *
 * Creates the tables the `database` notification channel and the
 * preference layer depend on:
 * - notifications
 * - notification_preferences
 *
 * Previously no migration shipped these — `preferences.ts` even
 * documented the schema in a comment and told apps to hand-roll the
 * migration — so out of the box `notify(..., ['database'])` crashed
 * with "no such table: notifications". Modeled on auth-tables.ts: one
 * cross-dialect `CREATE TABLE IF NOT EXISTS` per table, dialect bits
 * sourced from {@link sqlHelpers}.
 */

import { log } from '@stacksjs/logging'
import { env as envVars } from '@stacksjs/env'
import { db } from './utils'
import { sqlHelpers } from './sql-helpers'

type SqlHelpers = ReturnType<typeof sqlHelpers>

function getDbDriver(): string {
  return envVars.DB_CONNECTION || 'sqlite'
}

/**
 * `CREATE TABLE IF NOT EXISTS notifications` for the given dialect.
 * Pure (no execution) so the cross-dialect DDL is unit-testable.
 * Columns match the `DatabaseNotification` interface in
 * `notifications/src/drivers/database.ts`.
 */
export function notificationsTableSql(sql: SqlHelpers): string {
  const { pkColumn, nullableTimestamp } = sql
  return `CREATE TABLE IF NOT EXISTS notifications (
    ${pkColumn},
    user_id INTEGER NOT NULL,
    type VARCHAR(255) NOT NULL,
    data TEXT NOT NULL,
    read_at ${nullableTimestamp},
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at ${nullableTimestamp}
  )`
}

/**
 * `CREATE TABLE IF NOT EXISTS notification_preferences`. The
 * `UNIQUE (user_id, channel, category)` constraint is what makes the
 * preference upsert safe — matches `NotificationPreferenceRow`.
 */
export function notificationPreferencesTableSql(sql: SqlHelpers): string {
  const { pkColumn, boolTrue, nullableTimestamp } = sql
  return `CREATE TABLE IF NOT EXISTS notification_preferences (
    ${pkColumn},
    user_id INTEGER NOT NULL,
    channel VARCHAR(50) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT ${boolTrue},
    category VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at ${nullableTimestamp},
    UNIQUE (user_id, channel, category)
  )`
}

/**
 * Create the notification + notification_preferences tables. Idempotent
 * (`IF NOT EXISTS`), so it's safe to run on every `buddy migrate`.
 */
export async function migrateNotificationTables(options: { verbose?: boolean } = {}): Promise<{ success: boolean, error?: string }> {
  const dbDriver = getDbDriver()
  const sql = sqlHelpers(dbDriver)

  if (options.verbose)
    log.info(`Creating notification tables for ${dbDriver}...`)

  try {
    if (options.verbose) log.info('Creating notifications table...')
    await db.unsafe(notificationsTableSql(sql)).execute()
    await db.unsafe(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id)`).execute()

    if (options.verbose) log.info('Creating notification_preferences table...')
    await db.unsafe(notificationPreferencesTableSql(sql)).execute()
    await db.unsafe(`CREATE INDEX IF NOT EXISTS idx_notification_preferences_user ON notification_preferences (user_id)`).execute()

    if (options.verbose) log.success('Notification tables created')
    return { success: true }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log.error(`Failed to create notification tables: ${message}`)
    return { success: false, error: message }
  }
}
