import { Action } from '@stacksjs/actions'
import { Notification } from '@stacksjs/orm'

interface NotificationData {
  body?: string
  recipient?: string
  subject?: string
}

function parseData(value: unknown): NotificationData {
  if (typeof value !== 'string')
    return {}

  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed as NotificationData : {}
  }
  catch {
    return { body: value }
  }
}

export default new Action({
  name: 'NotificationDashboardAction',
  description: 'Returns database inbox notification stats and recent notifications.',
  method: 'GET',
  async handle() {
    try {
      const allNotifications = await Notification.orderByDesc('id').limit(50).get()

      const notifications = allNotifications.map((record) => {
        const data = parseData(record.get('data'))
        const type = String(record.get('type') || 'notification')
        const readAt = record.get('read_at')

        return {
          id: Number(record.get('id')),
          type,
          recipient: data.recipient || `User #${Number(record.get('user_id'))}`,
          subject: data.subject || type,
          body: data.body || '',
          status: readAt ? 'read' : 'unread',
          read_at: readAt,
          time: String(record.get('created_at') || ''),
        }
      })

      const read = notifications.filter(notification => notification.status === 'read').length
      const unread = notifications.length - read
      const total = notifications.length

      const stats = [
        { label: 'Notifications', value: String(total) },
        { label: 'Read', value: total > 0 ? `${Math.round((read / total) * 100)}%` : '0%' },
        { label: 'Unread', value: String(unread) },
      ]

      return { notifications, stats }
    }
    catch {
      return {
        notifications: [],
        stats: [
          { label: 'Notifications', value: '0' },
          { label: 'Read', value: '0%' },
          { label: 'Unread', value: '0' },
        ],
      }
    }
  },
})
