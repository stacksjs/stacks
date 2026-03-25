import { Action } from '@stacksjs/actions'
import { EmailList, Subscriber } from '@stacksjs/orm'

export default new Action({
  name: 'ListIndexAction',
  description: 'Returns mailing list data for the dashboard.',
  method: 'GET',
  async handle() {
    const items = await EmailList.orderBy('created_at', 'desc').limit(50).get()
    const listCount = await EmailList.count()
    const subscriberCount = await Subscriber.count()

    const stats = [
      { label: 'Total Subscribers', value: String(subscriberCount) },
      { label: 'Email Lists', value: String(listCount) },
      { label: 'Unsubscribed', value: '-' },
      { label: 'Avg Open Rate', value: '-' },
    ]

    return {
      lists: items.map(i => i.toJSON()),
      stats,
    }
  },
})
