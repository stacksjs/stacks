import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { emailSDK } from '@stacksjs/email'
import { response } from '@stacksjs/router'
import { dashboardRequestValue } from '../dashboard-request'
import { dashboardMailbox, inboxActionError } from './inbox-request'

const RANGES = ['day', 'week', 'month', 'year'] as const
type ActivityRange = typeof RANGES[number]

interface DeliveryRow {
  id: number
  recipient: string
  subject: string | null
  status: string
  sent_at: string | null
  created_at: string | null
}

interface ActivityItem {
  id: string
  direction: 'received' | 'sent'
  subject: string
  correspondent: string
  occurred_at: string
  status: string
}

interface Bucket {
  key: string
  label: string
  start: Date
  end: Date
}

function queryValue(request: RequestInstance, key: string): string {
  return dashboardRequestValue(request, key)
}

function startOfHour(date: Date): Date {
  const result = new Date(date)
  result.setMinutes(0, 0, 0)
  return result
}

function startOfDay(date: Date): Date {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  return result
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addHours(date: Date, amount: number): Date {
  const result = new Date(date)
  result.setHours(result.getHours() + amount)
  return result
}

function addDays(date: Date, amount: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + amount)
  return result
}

function addMonths(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1)
}

function buildBuckets(range: ActivityRange, now: Date): Bucket[] {
  if (range === 'day') {
    const end = addHours(startOfHour(now), 1)
    const start = addHours(end, -24)
    return Array.from({ length: 24 }, (_, index) => {
      const bucketStart = addHours(start, index)
      return {
        key: bucketStart.toISOString(),
        label: bucketStart.toLocaleTimeString([], { hour: 'numeric' }),
        start: bucketStart,
        end: addHours(bucketStart, 1),
      }
    })
  }

  if (range === 'year') {
    const end = addMonths(startOfMonth(now), 1)
    const start = addMonths(end, -12)
    return Array.from({ length: 12 }, (_, index) => {
      const bucketStart = addMonths(start, index)
      return {
        key: bucketStart.toISOString(),
        label: bucketStart.toLocaleDateString([], { month: 'short' }),
        start: bucketStart,
        end: addMonths(bucketStart, 1),
      }
    })
  }

  const days = range === 'week' ? 7 : 30
  const end = addDays(startOfDay(now), 1)
  const start = addDays(end, -days)
  return Array.from({ length: days }, (_, index) => {
    const bucketStart = addDays(start, index)
    return {
      key: bucketStart.toISOString(),
      label: bucketStart.toLocaleDateString([], range === 'week'
        ? { weekday: 'short' }
        : { month: 'short', day: 'numeric' }),
      start: bucketStart,
      end: addDays(bucketStart, 1),
    }
  })
}

function timestamp(value: string | null | undefined): number {
  if (!value)
    return Number.NaN
  return new Date(value).getTime()
}

function inPeriod(value: string | null | undefined, start: Date, end: Date): boolean {
  const time = timestamp(value)
  return Number.isFinite(time) && time >= start.getTime() && time < end.getTime()
}

function percentChange(current: number, previous: number): number | null {
  if (previous === 0)
    return current === 0 ? 0 : null
  return Number((((current - previous) / previous) * 100).toFixed(1))
}

export default new Action({
  name: 'InboxActivityAction',
  description: 'Returns deterministic inbound and outbound mail activity for the dashboard.',
  method: 'GET',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const requestedRange = queryValue(request, 'range').toLowerCase()
    const range = RANGES.includes(requestedRange as ActivityRange)
      ? requestedRange as ActivityRange
      : 'week'
    let mailbox: string
    try {
      mailbox = dashboardMailbox(request)
    }
    catch (error) {
      return inboxActionError(error, 'Inbox activity could not be loaded.')
    }
    const buckets = buildBuckets(range, new Date())
    const periodStart = buckets[0]!.start
    const periodEnd = buckets.at(-1)!.end
    const periodLength = periodEnd.getTime() - periodStart.getTime()
    const previousStart = new Date(periodStart.getTime() - periodLength)

    let inbox
    let deliveryRows: DeliveryRow[]
    try {
      [inbox, deliveryRows] = await Promise.all([
        emailSDK.getInbox(mailbox, { limit: 1000 }),
        db
          .selectFrom('notification_deliveries')
          .select(['id', 'recipient', 'subject', 'status', 'sent_at', 'created_at'])
          .where('channel', '=', 'email')
          .where('created_at', '>=', previousStart.toISOString())
          .orderBy('created_at', 'desc')
          .execute() as Promise<DeliveryRow[]>,
      ])
    }
    catch (error) {
      return inboxActionError(error, 'Inbox activity could not be loaded.')
    }

    const currentInbound = inbox.filter(email => inPeriod(email.date, periodStart, periodEnd))
    const previousInbound = inbox.filter(email => inPeriod(email.date, previousStart, periodStart))
    const currentOutbound = deliveryRows.filter(delivery => inPeriod(delivery.sent_at || delivery.created_at, periodStart, periodEnd))
    const previousOutbound = deliveryRows.filter(delivery => inPeriod(delivery.sent_at || delivery.created_at, previousStart, periodStart))

    const series = buckets.map(bucket => ({
      key: bucket.key,
      label: bucket.label,
      received: currentInbound.filter(email => inPeriod(email.date, bucket.start, bucket.end)).length,
      sent: currentOutbound.filter(delivery => inPeriod(delivery.sent_at || delivery.created_at, bucket.start, bucket.end)).length,
      failed: currentOutbound.filter(delivery =>
        delivery.status === 'failed'
        && inPeriod(delivery.sent_at || delivery.created_at, bucket.start, bucket.end),
      ).length,
    }))

    const currentMessages = currentInbound.length + currentOutbound.length
    const previousMessages = previousInbound.length + previousOutbound.length
    const unread = currentInbound.filter(email => !email.read).length
    const attachments = currentInbound.filter(email => email.hasAttachments).length
    const failed = currentOutbound.filter(delivery => delivery.status === 'failed').length

    const deliveryStatuses = {
      sent: currentOutbound.filter(delivery => delivery.status === 'sent').length,
      delivered: currentOutbound.filter(delivery => delivery.status === 'delivered').length,
      failed,
      pending: currentOutbound.filter(delivery => delivery.status === 'pending').length,
    }

    const recentInbound: ActivityItem[] = currentInbound.map(email => ({
      id: `inbound:${email.messageId}`,
      direction: 'received',
      subject: email.subject || '(no subject)',
      correspondent: email.fromName || email.from,
      occurred_at: email.date,
      status: email.read ? 'read' : 'unread',
    }))
    const recentOutbound: ActivityItem[] = currentOutbound.map(delivery => ({
      id: `outbound:${delivery.id}`,
      direction: 'sent',
      subject: delivery.subject || '(no subject)',
      correspondent: delivery.recipient,
      occurred_at: delivery.sent_at || delivery.created_at || '',
      status: delivery.status,
    }))

    const recent = [...recentInbound, ...recentOutbound]
      .sort((a, b) => timestamp(b.occurred_at) - timestamp(a.occurred_at))
      .slice(0, 12)

    return response.json({
      mailbox,
      range,
      period: {
        start: periodStart.toISOString(),
        end: periodEnd.toISOString(),
      },
      stats: {
        messages: currentMessages,
        unread,
        failed,
        attachments,
        message_change: percentChange(currentMessages, previousMessages),
        unread_rate: currentInbound.length > 0
          ? Number(((unread / currentInbound.length) * 100).toFixed(1))
          : 0,
      },
      folder_counts: {
        inbox: inbox.filter(email => !email.read).length,
        starred: 0,
        sent: 0,
        drafts: 0,
        archive: 0,
        spam: 0,
        trash: 0,
      },
      mailbox_state: {
        read: currentInbound.length - unread,
        unread,
      },
      delivery_statuses: deliveryStatuses,
      series,
      recent,
    })
  },
})
