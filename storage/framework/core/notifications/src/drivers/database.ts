import { log } from '@stacksjs/cli'
import { db } from '@stacksjs/database'

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
  data: Record<string, any>
}

export const DatabaseNotificationDriver = {
  async send(options: CreateNotificationOptions): Promise<DatabaseNotification> {
    const now = new Date().toISOString()

    const result = await db
      .insertInto('notifications' as any)
      .values({
        user_id: options.userId,
        type: options.type,
        data: JSON.stringify(options.data),
        read_at: null,
        created_at: now,
        updated_at: now,
      } as any)
      .execute()

    // Driver-aware insertId extraction. MySQL exposes
    // `result[0].insertId`, Postgres returns `insertId` on the top-level
    // result object (when RETURNING is used), and SQLite reports
    // `insertId` directly. Coalesce all three so the returned record
    // carries the actual primary key regardless of driver.
    const r = result as any
    const insertId = Number(
      r?.[0]?.insertId
      ?? r?.insertId
      ?? r?.lastInsertRowid
      ?? r?.lastInsertId
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
      .selectFrom('notifications' as any)
      .selectAll()
      .where('user_id' as any, '=', userId)
      .orderBy('created_at' as any, 'desc')
      .execute()

    return notifications as unknown as DatabaseNotification[]
  },

  async getUnreadNotifications(userId: number): Promise<DatabaseNotification[]> {
    const notifications = await db
      .selectFrom('notifications' as any)
      .selectAll()
      .where('user_id' as any, '=', userId)
      .where('read_at' as any, 'is', null)
      .orderBy('created_at' as any, 'desc')
      .execute()

    return notifications as unknown as DatabaseNotification[]
  },

  async markAsRead(id: number): Promise<void> {
    await db
      .updateTable('notifications' as any)
      .set({ read_at: new Date().toISOString() } as any)
      .where('id' as any, '=', id)
      .execute()
  },

  async markAllAsRead(userId: number): Promise<void> {
    await db
      .updateTable('notifications' as any)
      .set({ read_at: new Date().toISOString() } as any)
      .where('user_id' as any, '=', userId)
      .where('read_at' as any, 'is', null)
      .execute()
  },

  async unreadCount(userId: number): Promise<number> {
    const result = await db
      .selectFrom('notifications' as any)
      .select(db.fn.countAll().as('count'))
      .where('user_id' as any, '=', userId)
      .where('read_at' as any, 'is', null)
      .executeTakeFirst()

    return Number((result as any)?.count ?? 0)
  },

  async deleteNotification(id: number): Promise<void> {
    await db
      .deleteFrom('notifications' as any)
      .where('id' as any, '=', id)
      .execute()
  },

  async deleteAllNotifications(userId: number): Promise<void> {
    await db
      .deleteFrom('notifications' as any)
      .where('user_id' as any, '=', userId)
      .execute()
  },
}

export function useDatabase(): typeof DatabaseNotificationDriver {
  return DatabaseNotificationDriver
}
