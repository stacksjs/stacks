import { log } from '@stacksjs/cli'
import { db } from '@stacksjs/database'
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
  sentAt = new Date().toISOString(),
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

export async function recordNotificationDelivery(record: NotificationDeliveryRecord): Promise<void> {
  const now = new Date().toISOString()

  try {
    await db
      .insertInto('notification_deliveries')
      .values({
        user_id: record.userId ?? null,
        channel: record.channel,
        recipient: record.recipient,
        subject: record.subject ?? null,
        body: record.body,
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
