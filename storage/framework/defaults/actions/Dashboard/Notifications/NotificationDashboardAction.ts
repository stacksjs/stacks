import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'NotificationDashboardAction',
  description: 'Returns notification dashboard stats and channel data.',
  method: 'GET',
  async handle() {
    return {
      stats: {
        total: 15642,
        delivered: 15234,
        failed: 408,
        deliveryRate: '97.4%',
      },
      channels: [
        { name: 'Email', sent: 8765, delivered: 8543, failed: 222 },
        { name: 'SMS', sent: 3456, delivered: 3345, failed: 111 },
        { name: 'Push', sent: 2345, delivered: 2270, failed: 75 },
        { name: 'Database', sent: 1076, delivered: 1076, failed: 0 },
      ],
      recent: [
        { id: 1, channel: 'email', recipient: 'chris@stacks.dev', subject: 'Welcome!', status: 'delivered', sentAt: new Date(Date.now() - 3600000).toISOString() },
      ],
    }
  },
})
