import { log } from '@stacksjs/cli'
import { db } from '@stacksjs/database'

// `./database-schema.d.ts` augments `@stacksjs/database`'s
// `DatabaseSchema` with the `notifications` + `notification_preferences`
// tables so the chain calls below type-check without per-call `as any`
// (Notif-3 follow-up to #1923 / #1937).

export interface DatabaseNotification {
  id: number
  user_id: number
  type: string
  data: string
  read_at: string | null
  created_at: string
  updated_at: string | null
}

export interface CreateNotificationOptions {
  userId: number
  type: string
  data: Record<string, unknown>
}

/** Shape of a row-insert result across the supported drivers. */
interface InsertResultLike {
  insertId?: number | bigint
  lastInsertRowid?: number | bigint
  lastInsertId?: number | bigint
}

export const DatabaseNotificationDriver = {
  async send(options: CreateNotificationOptions): Promise<DatabaseNotification> {
    const now = new Date().toISOString()

    const result = await db
      .insertInto('notifications')
      .values({
        user_id: options.userId,
        type: options.type,
        data: JSON.stringify(options.data),
        read_at: null,
        created_at: now,
        updated_at: now,
      })
      .execute()

    // Driver-aware insertId extraction. MySQL exposes
    // `result[0].insertId`, Postgres returns `insertId` on the top-level
    // result object (when RETURNING is used), and SQLite reports
    // `lastInsertRowid` directly. Coalesce so the returned record
    // carries the actual primary key regardless of driver. The unknown
    // cast is intentional: the chain returns `Promise<any>` and the
    // real shape is driver-specific.
    const r = result as unknown as InsertResultLike | [InsertResultLike]
    const arr = Array.isArray(r) ? r[0] : r
    const insertId = Number(
      arr?.insertId
      ?? arr?.lastInsertRowid
      ?? arr?.lastInsertId
      ?? 0,
    )

    log.info(`Database notification sent to user ${options.userId}: ${options.type}`)

    return {
      id: insertId,
      user_id: options.userId,
      type: options.type,
      data: JSON.stringify(options.data),
      read_at: null,
      created_at: now,
      updated_at: now,
    }
  },

  async getUserNotifications(userId: number): Promise<DatabaseNotification[]> {
    const notifications = await db
      .selectFrom('notifications')
      .selectAll()
      .where('user_id', '=', userId)
      .orderBy('created_at', 'desc')
      .execute()

    return notifications as unknown as DatabaseNotification[]
  },

  async getUnreadNotifications(userId: number): Promise<DatabaseNotification[]> {
    const notifications = await db
      .selectFrom('notifications')
      .selectAll()
      .where('user_id', '=', userId)
      .where('read_at', 'is', null)
      .orderBy('created_at', 'desc')
      .execute()

    return notifications as unknown as DatabaseNotification[]
  },

  async markAsRead(id: number): Promise<void> {
    await db
      .updateTable('notifications')
      .set({ read_at: new Date().toISOString() })
      .where('id', '=', id)
      .execute()
  },

  async markAllAsRead(userId: number): Promise<void> {
    await db
      .updateTable('notifications')
      .set({ read_at: new Date().toISOString() })
      .where('user_id', '=', userId)
      .where('read_at', 'is', null)
      .execute()
  },

  async unreadCount(userId: number): Promise<number> {
    const result = await db
      .selectFrom('notifications')
      .select(db.fn.countAll().as('count'))
      .where('user_id', '=', userId)
      .where('read_at', 'is', null)
      .executeTakeFirst()

    return Number((result as unknown as { count?: number | string } | undefined)?.count ?? 0)
  },

  async deleteNotification(id: number): Promise<void> {
    await db
      .deleteFrom('notifications')
      .where('id', '=', id)
      .execute()
  },

  async deleteAllNotifications(userId: number): Promise<void> {
    await db
      .deleteFrom('notifications')
      .where('user_id', '=', userId)
      .execute()
  },
}

export function useDatabase(): typeof DatabaseNotificationDriver {
  return DatabaseNotificationDriver
}
