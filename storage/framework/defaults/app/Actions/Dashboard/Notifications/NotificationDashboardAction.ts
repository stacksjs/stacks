import { Action } from '@stacksjs/actions'
import { Notification } from '@stacksjs/orm'

export default new Action({
  name: 'NotificationDashboardAction',
  description: 'Returns notification dashboard stats and recent notifications.',
  method: 'GET',
  async handle() {
    try {
      const allNotifications = await Notification.orderByDesc('id').limit(50).get()

      const notifications = allNotifications.map(r => ({
        type: String(r.get('type') || 'email'),
        recipient: String(r.get('recipient') || r.get('notifiable_id') || ''),
        subject: String(r.get('subject') || r.get('data') || ''),
        status: String(r.get('status') || 'sent'),
        time: String(r.get('created_at') || ''),
      }))

      const sent = notifications.filter(n => n.status === 'sent' || n.status === 'delivered').length
      const failed = notifications.filter(n => n.status === 'failed').length
      const total = notifications.length

      const stats = [
        { label: 'Sent Today', value: String(sent) },
        { label: 'Delivered', value: total > 0 ? `${Math.round((sent / total) * 100)}%` : '0%' },
        { label: 'Failed', value: String(failed) },
      ]

      return { notifications, stats }
    }
    catch {
      return {
        notifications: [],
        stats: [
          { label: 'Sent Today', value: '0' },
          { label: 'Delivered', value: '0%' },
          { label: 'Failed', value: '0' },
        ],
      }
    }
  },
})
