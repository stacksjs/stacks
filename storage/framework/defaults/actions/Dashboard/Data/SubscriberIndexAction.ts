import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'SubscriberIndexAction',
  description: 'Returns subscriber data for the dashboard.',
  method: 'GET',
  async handle() {
    return {
      data: [
        { id: 1, email: 'subscriber1@example.com', status: 'active', subscribedAt: '2024-01-15', source: 'website' },
        { id: 2, email: 'subscriber2@example.com', status: 'active', subscribedAt: '2024-02-20', source: 'api' },
        { id: 3, email: 'subscriber3@example.com', status: 'unsubscribed', subscribedAt: '2024-01-05', source: 'import' },
      ],
      total: 8934,
    }
  },
})
