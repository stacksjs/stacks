import { log } from '@stacksjs/cli'
import { config } from '@stacksjs/config'
import { db, sqlDateTime} from '@stacksjs/database'
import type {
  NotificationChannel,
  NotificationPayload,
  NotificationRecipient,
  NotifyOptions,
  NotifyResult,
} from './index'

export interface NotificationDeliveryRecord {
  userId?: number
  channel: NotificationChannel
  recipient: string
  subject?: string
  body: string
  status: 'sent' | 'failed'
  error?: string
  metadata?: Record<string, unknown>
  sentAt: string
}

export function resolveDeliveryRecipient(recipient: NotificationRecipient, channel: NotificationChannel): string {
  switch (channel) {
    case 'email':
      return recipient.email || ''
    case 'sms':
      return recipient.phone || ''
    case 'push':
      return Array.isArray(recipient.pushTokens) ? recipient.pushTokens.join(', ') : recipient.pushTokens || ''
    case 'broadcast':
      return recipient.broadcastChannel || (recipient.userId ? `private-user-${recipient.userId}` : 'notifications')
    case 'database':
      return recipient.userId ? `User #${recipient.userId}` : ''
    case 'chat':
      return 'Configured chat destination'
  }
}

export function makeDeliveryRecord(
  recipient: NotificationRecipient,
  payload: NotificationPayload,
  result: NotifyResult,
  options: NotifyOptions,
  sentAt = sqlDateTime(),
): NotificationDeliveryRecord {
  return {
    userId: recipient.userId,
    channel: result.channel,
    recipient: resolveDeliveryRecipient(recipient, result.channel),
    subject: payload.subject,
    body: payload.body,
    status: result.success ? 'sent' : 'failed',
    error: result.error?.message,
    metadata: {
      ...payload.data,
      ...(options.category ? { category: options.category } : {}),
    },
    sentAt,
  }
}

/**
 * Whether this channel's deliveries are recorded (stacksjs/stacks#328).
 *
 * Read from the `config` proxy rather than a destructured section, so a value
 * set after this module was first imported is still seen - the sections are
 * snapshots refreshed once at boot.
 *
 * Defaults to ON. The value of delivery tracking is in not having to remember
 * to enable it before the send you needed to explain.
 */
export function tracksChannel(channel: NotificationChannel): boolean {
  const tracking = config.notification?.tracking

  if (tracking?.enabled === false)
    return false

  const channels = tracking?.channels
  // Omitted or empty means every channel: an empty allowlist that meant
  // "none" would silently disable tracking for a project that wrote
  // `channels: []` intending "no restriction".
  if (!channels || channels.length === 0)
    return true

  return channels.includes(channel as (typeof channels)[number])
}

export async function recordNotificationDelivery(record: NotificationDeliveryRecord): Promise<void> {
  if (!tracksChannel(record.channel))
    return

  const now = sqlDateTime()

  try {
    await db
      .insertInto('notification_deliveries')
      .values({
        user_id: record.userId ?? null,
        channel: record.channel,
        recipient: record.recipient,
        subject: record.subject ?? null,
        body: config.notification?.tracking?.body === false ? '' : record.body,
        status: record.status,
        error: record.error ?? null,
        metadata: record.metadata ? JSON.stringify(record.metadata) : null,
        sent_at: record.sentAt,
        created_at: now,
        updated_at: now,
      })
      .execute()
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log.warn(`[notifications] could not record ${record.channel} delivery: ${message}`)
  }
}
