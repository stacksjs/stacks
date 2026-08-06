/**
 * Notification Tables Migration (stacksjs/stacks#1937)
 *
 * Creates the tables the `database` notification channel and the
 * preference layer depend on:
 * - notifications
 * - notification_preferences
 * - notification_deliveries
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
import { indexSqlForDialect, isDuplicateIndexError } from './dialect'

type SqlHelpers = ReturnType<typeof sqlHelpers>

function getDbDriver(): string {
  return process.env.DB_CONNECTION || envVars.DB_CONNECTION || 'sqlite'
}

/**
 * `CREATE TABLE IF NOT EXISTS notifications` for the given dialect.
 * Pure (no execution) so the cross-dialect DDL is unit-testable.
 * Columns match the `DatabaseNotification` interface in
 * `notifications/src/drivers/database.ts`.
 */
export function notificationsTableSql(sql: SqlHelpers): string {
  const { bigPkColumn, bigInteger, nullableTimestamp, datetime } = sql
  return `CREATE TABLE IF NOT EXISTS notifications (
    ${bigPkColumn},
    user_id ${bigInteger},
    type VARCHAR(255) NOT NULL,
    data TEXT NOT NULL,
    read_at ${nullableTimestamp},
    uuid VARCHAR(255),
    created_at ${datetime} DEFAULT CURRENT_TIMESTAMP,
    updated_at ${nullableTimestamp}
  )`
}

/**
 * `CREATE TABLE IF NOT EXISTS notification_preferences`. The
 * `UNIQUE (user_id, channel, category)` constraint is what makes the
 * preference upsert safe — matches `NotificationPreferenceRow`.
 */
export function notificationPreferencesTableSql(sql: SqlHelpers): string {
  const { bigPkColumn, bigInteger, boolTrue, nullableTimestamp, datetime } = sql
  return `CREATE TABLE IF NOT EXISTS notification_preferences (
    ${bigPkColumn},
    user_id ${bigInteger} NOT NULL,
    channel VARCHAR(50) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT ${boolTrue},
    category VARCHAR(255),
    created_at ${datetime} DEFAULT CURRENT_TIMESTAMP,
    updated_at ${nullableTimestamp},
    UNIQUE (user_id, channel, category)
  )`
}

/**
 * `CREATE TABLE IF NOT EXISTS notification_deliveries`. This table records
 * every transport attempt made by `notify()` without mixing outbound delivery
 * state into the database inbox table.
 */
export function notificationDeliveriesTableSql(sql: SqlHelpers): string {
  const { bigPkColumn, nullableTimestamp, datetime } = sql
  return `CREATE TABLE IF NOT EXISTS notification_deliveries (
    ${bigPkColumn},
    user_id INTEGER,
    channel VARCHAR(50) NOT NULL,
    recipient TEXT NOT NULL,
    subject VARCHAR(255),
    body TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    error TEXT,
    metadata TEXT,
    sent_at ${nullableTimestamp},
    created_at ${datetime} DEFAULT CURRENT_TIMESTAMP,
    updated_at ${nullableTimestamp}
  )`
}

/** Create one index idempotently on every supported SQL dialect. */
async function createIndex(statement: string, dialect: string): Promise<void> {
  try {
    await db.unsafe(indexSqlForDialect(statement, dialect)).execute()
  }
  catch (error) {
    if (!isDuplicateIndexError(error))
      throw error
  }
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
    await createIndex(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id)`, dbDriver)

    if (options.verbose) log.info('Creating notification_preferences table...')
    await db.unsafe(notificationPreferencesTableSql(sql)).execute()
    await createIndex(`CREATE INDEX IF NOT EXISTS idx_notification_preferences_user ON notification_preferences (user_id)`, dbDriver)

    if (options.verbose) log.info('Creating notification deliveries table...')
    await db.unsafe(notificationDeliveriesTableSql(sql)).execute()
    await createIndex(`CREATE INDEX IF NOT EXISTS idx_notification_deliveries_channel ON notification_deliveries (channel)`, dbDriver)
    await createIndex(`CREATE INDEX IF NOT EXISTS idx_notification_deliveries_status ON notification_deliveries (status)`, dbDriver)

    if (options.verbose) log.success('Notification tables created')
    return { success: true }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log.error(`Failed to create notification tables: ${message}`)
    return { success: false, error: message }
  }
}
