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

export interface NotificationDeliveryHistoryQuery {
  page?: number
  perPage?: number
  channel?: NotificationDeliveryChannel | 'all'
  status?: NotificationDeliveryStatus | 'all'
  search?: string
  sort?: 'sent_at' | 'recipient' | 'channel' | 'status' | 'id'
  direction?: 'asc' | 'desc'
  signal?: AbortSignal
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

export async function fetchNotificationDeliveryHistory(
  query: NotificationDeliveryHistoryQuery = {},
): Promise<NotificationDeliveryHistory | null> {
  const params = new URLSearchParams()
  params.set('page', String(query.page || 1))
  params.set('per_page', String(query.perPage || 20))
  params.set('sort', query.sort || 'sent_at')
  params.set('direction', query.direction || 'desc')
  if (query.channel && query.channel !== 'all')
    params.set('channel', query.channel)
  if (query.status && query.status !== 'all')
    params.set('status', query.status)
  if (query.search)
    params.set('search', query.search)

  try {
    return await dashboardApi<NotificationDeliveryHistory>(
      `/api/dashboard/notification-deliveries/history?${params.toString()}`,
      { signal: query.signal },
    )
  }
  catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError')
      return null
    pushToast('error', 'Could not load notification delivery history', { detail: String(error) })
    return null
  }
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
