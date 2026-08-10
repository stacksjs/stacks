import { Action } from '@stacksjs/actions'
import { Subscriber } from '@stacksjs/orm'
import { safeGet } from '../../../../resources/functions/dashboard/data'
import { dashboardOperationalError } from '../dashboard-response'
import { dateValue, daysAgoIso, numberValue, textValue } from './data-records'

export default new Action({
  name: 'SubscriberIndexAction',
  description: 'Returns subscribers and native subscription statistics for the dashboard.',
  method: 'GET',
  apiResponse: true,
  async handle() {
    try {
      const rows = await Subscriber.orderByDesc('created_at').limit(100).get()
      const subscribers = rows.map(row => ({
        id: numberValue(safeGet(row, 'id', 0)),
        email: textValue(safeGet(row, 'email')),
        status: textValue(safeGet(row, 'status'), 'pending'),
        source: textValue(safeGet(row, 'source'), 'unknown'),
        unsubscribedAt: dateValue(safeGet(row, 'unsubscribed_at', safeGet(row, 'unsubscribedAt'))),
        createdAt: dateValue(safeGet(row, 'created_at', safeGet(row, 'createdAt'))),
      }))

      const [total, subscribed, unsubscribed, newThisMonth] = await Promise.all([
        Subscriber.count(),
        Subscriber.where('status', 'subscribed').count(),
        Subscriber.where('status', 'unsubscribed').count(),
        Subscriber.where('created_at', '>=', daysAgoIso(30)).count(),
      ])

      return {
        subscribers,
        stats: {
          total,
          subscribed,
          unsubscribed,
          newThisMonth,
        },
      }
    }
    catch (error) {
      return dashboardOperationalError(error, 'Subscribers could not be loaded.', 'SubscriberIndexAction')
    }
  },
})
