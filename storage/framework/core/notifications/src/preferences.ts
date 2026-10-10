import { log } from '@stacksjs/cli'
import { db, lockRow, sqlDateTime } from '@stacksjs/database/runtime'
import type { NotificationChannel } from './index'

/**
 * `notification_preferences` table — user-level opt-out per channel
 * (and optionally per category, e.g. `marketing` vs `system`).
 *
 * The migration is intentionally NOT shipped here — apps maintain their
 * own migration directory and column conventions. Generate the migration
 * yourself; the schema below is what the runtime expects.
 *
 * ```sql
 * CREATE TABLE notification_preferences (
 *   id           INTEGER PRIMARY KEY AUTOINCREMENT,
 *   user_id      INTEGER NOT NULL,
 *   channel      TEXT    NOT NULL,                  -- email | sms | chat | database | push
 *   enabled      INTEGER NOT NULL DEFAULT 1,        -- boolean (0/1)
 *   category     TEXT,                              -- optional, e.g. 'marketing'
 *   created_at   TEXT    NOT NULL,
 *   updated_at   TEXT    NOT NULL,
 *   UNIQUE (user_id, channel, category)
 * );
 *
 * CREATE INDEX idx_notification_preferences_user
 *   ON notification_preferences (user_id);
 * ```
 *
 * Postgres / MySQL equivalents: use `BOOLEAN` for `enabled`, `BIGINT` for
 * IDs, and `TIMESTAMP` for the timestamp columns. The `UNIQUE (user_id,
 * channel, category)` constraint is what makes the upsert below safe; if
 * your DB doesn't allow `NULL` to participate in `UNIQUE`, treat
 * `category IS NULL` as a sentinel "global" category instead.
 */
export interface NotificationPreferenceRow {
  id: number
  user_id: number
  channel: NotificationChannel | 'push'
  enabled: boolean | 0 | 1
  /** Optional sub-category — when omitted the row applies to *all* notifications on that channel. */
  category?: string | null
  created_at: string
  updated_at: string
}

/** All channels that can be filtered through preferences. */
export type PreferenceChannel = NotificationChannel | 'push'

const TABLE = 'notification_preferences'

/** Apply the nullable preference category without generating `IS $n` SQL.
 * Postgres requires `IS NULL`; query builders correctly express that through
 * `whereNull()`, while a bound value remains a normal equality predicate. */
interface PreferenceCategoryQuery<T> {
  where: (column: string, operator: string, value: string) => T
  whereNull: (column: string) => T
}

export function wherePreferenceCategory<T extends PreferenceCategoryQuery<T>>(query: T, category: string | null): T {
  return category === null
    ? query.whereNull('category')
    : query.where('category', '=', category)
}

/**
 * Load all notification preferences for a user as a Map keyed by channel.
 * Without a category, returns global preferences only. Category-specific
 * preferences are read only when that category is explicitly requested.
 * Returns `Map<channel, enabled>` — channels with no row recorded are
 * absent from the Map (callers should treat absent = enabled by default).
 *
 * If the `notification_preferences` table doesn't exist yet (apps that
 * haven't applied the migration) this returns an empty Map and logs a
 * one-line debug message rather than throwing — the user-facing notify()
 * flow shouldn't 500 because of an opt-in feature.
 *
 * @example
 * ```ts
 * const prefs = await getNotificationPreferences(user.id)
 * if (prefs.get('email') === false) console.log('user opted out of email')
 * ```
 */
export async function getNotificationPreferences(
  userId: number,
  category?: string,
): Promise<Map<PreferenceChannel, boolean>> {
  const map = new Map<PreferenceChannel, boolean>()
  try {
    // Table is now part of `DatabaseSchema` via
    // `./database-schema.d.ts` (Notif-3, follow-up to #1937).
    const q = wherePreferenceCategory(db.selectFrom(TABLE).select(['channel', 'enabled', 'category']).where('user_id', '=', userId), category ?? null)
    const rows = await q.execute() as Array<Pick<NotificationPreferenceRow, 'channel' | 'enabled' | 'category'>>
    for (const row of rows) {
      // Every row belongs to the requested category (or the global scope).
      map.set(row.channel, row.enabled === true || row.enabled === 1)
    }
  }
  catch (err) {
    log.debug?.(`[notifications] preferences lookup failed (table missing?): ${(err as Error).message}`)
  }
  return map
}

/**
 * Upsert a single preference row for `(user_id, channel, category)`.
 * The combination is treated as the natural key — calling this twice with
 * the same triple just toggles `enabled` on the existing row.
 *
 * @example
 * ```ts
 * // user opts out of marketing emails
 * await setNotificationPreference(user.id, 'email', false, 'marketing')
 * // ...later, opts back in
 * await setNotificationPreference(user.id, 'email', true, 'marketing')
 * ```
 */
export async function setNotificationPreference(
  userId: number,
  channel: PreferenceChannel,
  enabled: boolean,
  category?: string,
): Promise<void> {
  await db.transaction(async (trx) => {
    await lockRow(trx, 'users', { id: userId })
    await writeNotificationPreference(userId, channel, enabled, category)
  })
}

async function writeNotificationPreference(userId: number, channel: PreferenceChannel, enabled: boolean, category?: string): Promise<void> {
  if (!Number.isSafeInteger(userId) || userId <= 0 || typeof enabled !== 'boolean')
    throw new Error('A notification preference needs a valid user id and enabled boolean')
  const now = sqlDateTime()
  const cat = category ?? null

  // The caller holds the user's lock, making this portable upsert safe even
  // for global categories where SQL UNIQUE permits multiple NULL values.
  // Table is now declared via
  // `./database-schema.d.ts` (Notif-3, follow-up to #1937).
  const baseQuery = db
    .selectFrom(TABLE)
    .select(['id'])
    .where('user_id', '=', userId)
    .where('channel', '=', channel)
  const existing = await wherePreferenceCategory(baseQuery, cat)
    .executeTakeFirst() as { id?: number } | undefined

  if (existing?.id) {
    await db
      .updateTable(TABLE)
      .set({ enabled, updated_at: now })
      .where('id', '=', existing.id)
      .execute()
    return
  }

  await db
    .insertInto(TABLE)
    .values({
      user_id: userId,
      channel,
      enabled,
      category: cat,
      created_at: now,
      updated_at: now,
    })
    .execute()
}

/**
 * Bulk upsert preferences for a user — convenient for "save preferences"
 * forms that submit the user's full opt-in/out matrix in one POST.
 *
 * Saves the entire matrix inside one transaction and one user lock.
 * Iterates one upsert per entry rather than one mega-query because the
 * underlying conflict logic is keyed on `(user_id, channel, category)`
 * and a single SQL statement can't express that across N rows portably.
 *
 * @example
 * ```ts
 * await bulkSetPreferences(user.id, [
 *   { channel: 'email', enabled: false, category: 'marketing' },
 *   { channel: 'sms',   enabled: true },
 *   { channel: 'push',  enabled: false },
 * ])
 * ```
 */
export async function bulkSetPreferences(
  userId: number,
  prefs: Array<{ channel: PreferenceChannel, enabled: boolean, category?: string }>,
): Promise<void> {
  await db.transaction(async (trx) => {
    await lockRow(trx, 'users', { id: userId })
    for (const p of prefs)
      await writeNotificationPreference(userId, p.channel, p.enabled, p.category)
  })
}

/**
 * Filter a list of channels through a user's preferences.
 *
 * Returns the subset the user is opted *in* for. Channels with no row
 * recorded fall through as enabled (default-allow) so that introducing
 * the preferences feature doesn't suddenly break notifications for users
 * who never visited the preferences page.
 *
 * @example
 * ```ts
 * const allowed = await filterChannelsByPreferences(user.id, ['email', 'sms', 'push'])
 * // -> ['email', 'push']  (user disabled sms)
 * ```
 */
export async function filterChannelsByPreferences<T extends PreferenceChannel>(
  userId: number,
  channels: T[],
  category?: string,
): Promise<T[]> {
  const prefs = await getNotificationPreferences(userId, category)
  // Also overlay any "global" (no-category) prefs underneath the
  // category-specific lookup — a user who turned off `email` globally
  // shouldn't suddenly get marketing email back just because they never
  // toggled the marketing-specific row.
  if (category !== undefined) {
    const global = await getNotificationPreferences(userId, undefined)
    for (const [k, v] of global) {
      if (!v || !prefs.has(k)) prefs.set(k, v)
    }
  }
  return channels.filter((ch) => {
    const pref = prefs.get(ch)
    return pref === undefined ? true : pref === true
  })
}
