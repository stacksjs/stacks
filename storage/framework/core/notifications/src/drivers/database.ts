import { log } from '@stacksjs/cli'
import { createHash } from 'node:crypto'
import { db, enqueueAfterCommit, lockRow, sqlDateTime } from '@stacksjs/database/runtime'
import { emit, getServer } from '@stacksjs/realtime'

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
  /** Stable producer key. Concurrent retries return the original inbox row. */
  idempotencyKey?: string
  broadcast?: boolean
}

export function notificationChannel(userId: number): string { return `private-user.${userId}` }

function publishNotification(userId: number, event: string, data: Record<string, unknown>): void {
  const publish = () => {
    try { if (getServer()) emit(notificationChannel(userId), event, data) }
    catch { log.warn('Notification inbox broadcast failed; the persisted inbox remains available') }
  }
  if (!enqueueAfterCommit(publish)) publish()
}

/** Shape of a row-insert result across the supported drivers. */
interface InsertResultLike {
  id?: number | bigint
  insertId?: number | bigint
  lastInsertRowid?: number | bigint
  lastInsertId?: number | bigint
}

async function insertNotification(options: CreateNotificationOptions, uuid?: string): Promise<DatabaseNotification> {
    const now = sqlDateTime()

    const result = await db
      .insertInto('notifications')
      .values({
        user_id: options.userId,
        ...(uuid ? { uuid } : {}),
        type: options.type,
        data: JSON.stringify(options.data),
        read_at: null,
        created_at: now,
        updated_at: now,
      })
      .returning('id')
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
      arr?.id
      ?? arr?.insertId
      ?? arr?.lastInsertRowid
      ?? arr?.lastInsertId
      ?? 0,
    )

    if (!Number.isSafeInteger(insertId) || insertId <= 0)
      throw new Error('Database notification did not return a generated id')
    log.info(`Database notification sent to user ${options.userId}: ${options.type}`)

  if (options.broadcast !== false) publishNotification(options.userId, 'notifications.created', { id: insertId })

    return {
      id: insertId,
      user_id: options.userId,
      type: options.type,
      data: JSON.stringify(options.data),
      read_at: null,
      created_at: now,
      updated_at: now,
    }
}

export const DatabaseNotificationDriver = {
  async send(options: CreateNotificationOptions): Promise<DatabaseNotification> {
    if (options.idempotencyKey !== undefined) {
      if (!options.idempotencyKey || options.idempotencyKey.length > 255) throw new Error('A notification idempotency key must contain 1 to 255 characters')
      const hash = createHash('sha256').update(JSON.stringify([options.userId, options.type, options.idempotencyKey])).digest('hex')
      const uuid = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-8${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`
      return db.transaction(async (trx) => {
        const user = await lockRow(trx, 'users', { id: options.userId })
        if (!user) throw new Error('Notification recipient not found')
        const existing = await db.selectFrom('notifications').selectAll().where('user_id', '=', options.userId).where('uuid', '=', uuid).executeTakeFirst()
        if (existing) return { ...existing, id: Number(existing.id), user_id: Number(existing.user_id) } as unknown as DatabaseNotification
        return insertNotification(options, uuid)
      })
    }
    return insertNotification(options)
  },

  async getUserNotifications(userId: number): Promise<DatabaseNotification[]> {
    const notifications = await db
      .selectFrom('notifications')
      .selectAll()
      .where('user_id', '=', userId)
      .orderBy('created_at', 'desc')
      .execute()

    return notifications.map(notification => ({ ...notification, id: Number(notification.id), user_id: Number(notification.user_id) })) as unknown as DatabaseNotification[]
  },

  async getUnreadNotifications(userId: number): Promise<DatabaseNotification[]> {
    const notifications = await db
      .selectFrom('notifications')
      .selectAll()
      .where('user_id', '=', userId)
      .whereNull('read_at')
      .orderBy('created_at', 'desc')
      .execute()

    return notifications.map(notification => ({ ...notification, id: Number(notification.id), user_id: Number(notification.user_id) })) as unknown as DatabaseNotification[]
  },

  /** Supply the authenticated user id to scope the mutation in the same statement. */
  async markAsRead(id: number, userId?: number): Promise<void> {
    let query = db
      .updateTable('notifications')
      .set({ read_at: sqlDateTime() })
      .where('id', '=', id)
      .whereNull('read_at')
    if (userId !== undefined) query = query.where('user_id', '=', userId)
    await query.execute()
    if (userId) publishNotification(userId, 'notifications.read', { id })
  },

  async markAllAsRead(userId: number): Promise<void> {
    await db
      .updateTable('notifications')
      .set({ read_at: sqlDateTime() })
      .where('user_id', '=', userId)
      .whereNull('read_at')
      .execute()
    publishNotification(userId, 'notifications.read', { all: true })
  },

  async unreadCount(userId: number): Promise<number> {
    const result = await db
      .selectFrom('notifications')
      .select(db.fn.countAll().as('count'))
      .where('user_id', '=', userId)
      .whereNull('read_at')
      .executeTakeFirst()

    return Number((result as unknown as { count?: number | string } | undefined)?.count ?? 0)
  },

  /** Supply the authenticated user id to scope the mutation in the same statement. */
  async deleteNotification(id: number, userId?: number): Promise<void> {
    let query = db
      .deleteFrom('notifications')
      .where('id', '=', id)
    if (userId !== undefined) query = query.where('user_id', '=', userId)
    await query.execute()
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
