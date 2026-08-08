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
 * The columns each guaranteed table must end up with, for the check below.
 * Kept beside the DDL so the two move together.
 */
const REQUIRED_COLUMNS: Record<string, string[]> = {
  notifications: ['id', 'user_id', 'type', 'data', 'read_at'],
  notification_preferences: ['id', 'user_id', 'channel', 'enabled', 'category'],
  notification_deliveries: ['id', 'user_id', 'channel', 'recipient', 'body', 'status'],
}

/**
 * Warn when a guaranteed table already exists in a shape we would not have
 * created.
 *
 * `CREATE TABLE IF NOT EXISTS` against a name something else already claimed
 * does *nothing at all*, silently, and the guarantee then reports success. That
 * is the worst possible outcome: the notification driver goes on to query a
 * column that is not there, and the error surfaces far from the cause with
 * nothing pointing back here. An application whose own model corpus declares a
 * table of the same name hits this on its first migrate and has no way to know
 * why - the migration it generated ran, reported success, and changed nothing.
 *
 * A warning rather than a throw. This runs on every `buddy migrate`, and an
 * application that deliberately owns one of these names should not be unable to
 * migrate anything; it should be told, once, in words that name the table and
 * the missing columns.
 */
async function warnOnShapeMismatch(table: string): Promise<void> {
  const required = REQUIRED_COLUMNS[table]
  if (!required)
    return

  try {
    const rows: any = await db
      .unsafe(`SELECT * FROM ${table} WHERE 1 = 0`)
      .execute()

    // A zero-row result carries no column names on every driver, so fall back
    // to probing each column individually rather than guessing.
    const known = Array.isArray(rows) && rows.length > 0 ? Object.keys(rows[0]) : null
    const missing: string[] = []

    for (const column of required) {
      if (known) {
        if (!known.includes(column))
          missing.push(column)
        continue
      }

      try {
        await db.unsafe(`SELECT ${column} FROM ${table} WHERE 1 = 0`).execute()
      }
      catch {
        missing.push(column)
      }
    }

    if (missing.length > 0) {
      log.warn(
        `[notifications] "${table}" already exists without ${missing.join(', ')}. `
        + `CREATE TABLE IF NOT EXISTS left it untouched, so the notification `
        + `driver will fail on those columns. Something else owns this table - `
        + `either rename it, or stop using the framework's notification tables.`,
      )
    }
  }
  catch {
    // The table does not exist yet, which is the ordinary case: the CREATE
    // below is about to make it. Nothing to warn about.
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
    await warnOnShapeMismatch('notifications')
    await db.unsafe(notificationsTableSql(sql)).execute()
    await createIndex(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id)`, dbDriver)

    if (options.verbose) log.info('Creating notification_preferences table...')
    await warnOnShapeMismatch('notification_preferences')
    await db.unsafe(notificationPreferencesTableSql(sql)).execute()
    await createIndex(`CREATE INDEX IF NOT EXISTS idx_notification_preferences_user ON notification_preferences (user_id)`, dbDriver)

    if (options.verbose) log.info('Creating notification deliveries table...')
    await warnOnShapeMismatch('notification_deliveries')
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

/**
 * The foreign keys on `notifications.user_id` and
 * `notification_deliveries.user_id`, added after the model batch has run.
 *
 * **Why this is a second pass rather than part of the CREATE above.** The
 * guarantee runs *before* the model migrations, deliberately - a generated
 * model migration may normalize or rebuild these tables and needs them to
 * exist first. But that ordering is also why the keys never landed: the
 * guarantee created the table without them, and the model's own
 * `CREATE TABLE IF NOT EXISTS … REFERENCES users(id) ON DELETE CASCADE` then
 * became a no-op against a table that already existed. The migration ran, the
 * corpus declared the key, and the key was not there - reproducible by
 * dropping the table, un-recording the migration and replaying it.
 *
 * Putting `REFERENCES` inline in the guarantee does not work either: on a
 * brand-new database nothing has created `users` yet, so the CREATE would
 * fail and take the whole boot with it.
 *
 * So the keys are added at the end, when `users` is certain to exist, using
 * the same defensive-ALTER-and-swallow pattern `ensureUsersAuthColumns` uses
 * in `auth-tables.ts` and for the same reason: an installation that has
 * deliberately dropped the relation, or has no `users` table at all, must not
 * fail its migration over a constraint it does not want.
 *
 * Both spellings are dropped first. A column declared `REFERENCES` inline gets
 * Postgres's own `<table>_<column>_fkey`, while the generator emits
 * `<table>_<column>_fk`, and leaving both in place lets the stricter one win
 * every disagreement.
 */
export async function ensureNotificationForeignKeys(options: { verbose?: boolean } = {}): Promise<void> {
  const dbDriver = getDbDriver()

  // SQLite cannot add a foreign key to an existing table at all - it needs a
  // twelve-step rebuild - and the corpus creates these tables with the key
  // inline there anyway. Nothing to repair.
  if (dbDriver === 'sqlite')
    return

  for (const table of ['notifications', 'notification_deliveries'] as const) {
    const statements = [
      `ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS "${table}_user_id_fk"`,
      `ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS "${table}_user_id_fkey"`,
      `ALTER TABLE ${table} ADD CONSTRAINT "${table}_user_id_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE`,
    ]

    for (const statement of statements) {
      try {
        await db.unsafe(statement).execute()
      }
      catch (error) {
        // Swallowed per statement rather than per table, so a drop that finds
        // nothing does not skip the add that follows it.
        if (options.verbose)
          log.debug(`[notification-tables] Skipped: ${statement} (${error instanceof Error ? error.message : String(error)})`)
      }
    }
  }
}
