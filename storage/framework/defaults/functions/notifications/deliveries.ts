import { dashboardApi } from '../dashboard-api'
import { pushToast } from '../toasts'

export type DashboardDeliveryChannel = 'email' | 'sms'
export type NotificationDeliveryStatus = 'pending' | 'sent' | 'delivered' | 'failed'

export interface NotificationDelivery {
  id: number
  user_id?: number | null
  channel: DashboardDeliveryChannel
  recipient: string
  subject: string
  body: string
  status: NotificationDeliveryStatus
  error: string
  metadata: Record<string, unknown>
  sent_at: string
  created_at: string
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

export async function retryNotificationDelivery(delivery: NotificationDelivery): Promise<boolean> {
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
