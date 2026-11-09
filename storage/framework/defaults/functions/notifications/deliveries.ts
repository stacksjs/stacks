import { dashboardApi } from '../dashboard-api'
import { pushToast } from '../toasts'

export type DashboardDeliveryChannel = 'email' | 'sms'
export type NotificationDeliveryChannel = DashboardDeliveryChannel | 'chat' | 'database' | 'push' | 'broadcast'
export type NotificationDeliveryStatus = 'pending' | 'sent' | 'delivered' | 'failed'

export interface NotificationDelivery {
  id: number
  user_id?: number | null
  channel: NotificationDeliveryChannel
  recipient: string
  subject: string
  body: string
  status: NotificationDeliveryStatus
  error: string
  metadata: Record<string, unknown>
  sent_at: string
  created_at: string
}

export interface NotificationDeliveryChannelStats {
  channel: NotificationDeliveryChannel
  total: number
  sent: number
  delivered: number
  failed: number
  pending: number
  success_rate: number
}

export interface NotificationDeliveryOverview {
  stats: {
    total: number
    successful: number
    failed: number
    pending: number
    success_rate: number
    active_channels: number
  }
  statuses: Record<NotificationDeliveryStatus, number>
  channels: NotificationDeliveryChannelStats[]
  recent: NotificationDelivery[]
}

export interface NotificationDeliveryHistory {
  deliveries: NotificationDelivery[]
  pagination: {
    page: number
    per_page: number
    total: number
    total_pages: number
  }
}

export async function fetchNotificationDeliveries(channel: DashboardDeliveryChannel): Promise<NotificationDelivery[]> {
  try {
    const deliveries = await dashboardApi<NotificationDelivery[]>(`/api/dashboard/notification-deliveries?channel=${channel}`)
    if (!Array.isArray(deliveries))
      throw new TypeError('Server returned a non-array response')
    return deliveries
  }
  catch (error) {
    pushToast('error', `Could not load ${channel} deliveries`, { detail: String(error) })
    return []
  }
}

export async function fetchNotificationDeliveryOverview(): Promise<NotificationDeliveryOverview | null> {
  try {
    return await dashboardApi<NotificationDeliveryOverview>('/api/dashboard/notification-deliveries/overview')
  }
  catch (error) {
    pushToast('error', 'Could not load notification delivery overview', { detail: String(error) })
    return null
  }
}

/**
 * One page of the delivery history. `query` is what the History page's
 * useServerList sends: the search, channel, status, sort, direction, page and
 * per_page. Throws on a failed read so the list can say so.
 */
export async function fetchNotificationDeliveryHistory(query: URLSearchParams): Promise<NotificationDeliveryHistory> {
  return dashboardApi<NotificationDeliveryHistory>(`/api/dashboard/notification-deliveries/history?${query}`)
}

export async function retryNotificationDelivery(delivery: NotificationDelivery): Promise<boolean> {
  if (delivery.channel !== 'email' && delivery.channel !== 'sms') {
    pushToast('warning', 'Only email and SMS attempts can be retried from the dashboard')
    return false
  }

  try {
    await dashboardApi(`/api/dashboard/notification-deliveries/${delivery.id}/retry`, { method: 'POST' })
    pushToast('success', `${delivery.channel === 'email' ? 'Email' : 'SMS'} retry sent`)
    return true
  }
  catch (error) {
    pushToast('error', 'Notification retry failed', { detail: String(error) })
    return false
  }
}
