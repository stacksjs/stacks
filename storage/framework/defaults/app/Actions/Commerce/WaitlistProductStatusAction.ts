import type { WaitlistProductRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { waitlists } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'WaitlistProduct Status Statistics',
  description: 'WaitlistProduct Status Statistics Action',
  method: 'GET',
  async handle(request: WaitlistProductRequestType) {
    const startDate = request.getParam<Date>('startDate')
    const endDate = request.getParam<Date>('endDate')

    const [
      totalCount,
      waitingCount,
      notifiedCount,
      purchasedCount,
      conversionRates,
    ] = await Promise.all([
      waitlists.products.fetchCountBetweenDates(startDate, endDate),
      waitlists.products.fetchCountByStatus('waiting', startDate, endDate),
      waitlists.products.fetchCountByStatus('notified', startDate, endDate),
      waitlists.products.fetchCountByStatus('purchased', startDate, endDate),
      waitlists.products.fetchConversionRates(startDate, endDate),
    ])

    return response.json({
      totalCount,
      statusCounts: {
        waiting: waitingCount,
        notified: notifiedCount,
        purchased: purchasedCount,
      },
      conversionRates,
    })
  },
})
