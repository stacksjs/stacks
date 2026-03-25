import { Action } from '@stacksjs/actions'
import { Subscriber } from '@stacksjs/orm'

export default new Action({
  name: 'SubscriberIndexAction',
  description: 'Returns subscriber data for the dashboard.',
  method: 'GET',
  async handle() {
    const items = await Subscriber.orderBy('created_at', 'desc').limit(50).get()
    const count = await Subscriber.count()
    const plans = ['All Plans', 'Basic', 'Pro', 'Enterprise']

    const stats = [
      { label: 'Total Subscribers', value: String(count) },
      { label: 'Active', value: String(count) },
      { label: 'New This Month', value: '-' },
      { label: 'Churn Rate', value: '-' },
    ]

    return {
      subscribers: items.map(i => i.toJSON()),
      stats,
      plans,
    }
  },
})
