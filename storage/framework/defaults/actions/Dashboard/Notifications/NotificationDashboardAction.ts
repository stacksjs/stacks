import { Action } from '@stacksjs/actions'
import { Notification } from '@stacksjs/orm'

export default new Action({
  name: 'NotificationDashboardAction',
  description: 'Returns notification dashboard stats and recent notifications.',
  method: 'GET',
  async handle() {
    const items = await Notification.orderBy('created_at', 'desc').limit(50).get()
    const count = await Notification.count()

    const stats = [
      { label: 'Total Notifications', value: String(count) },
      { label: 'Delivered', value: '-' },
      { label: 'Failed', value: '-' },
    ]

    return {
      notifications: items.map(i => i.toJSON()),
      stats,
    }
  },
})
