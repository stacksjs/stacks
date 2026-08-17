import { Action } from '@stacksjs/actions'
import { waitlists } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'WaitlistProduct Status Statistics',
  description: 'WaitlistProduct Status Statistics Action',
  method: 'GET',
  async handle(request: RequestInstance) {
    // Params arrive as strings; `getParam` has no type parameter to change
    // that, and asking for `<Date>` only made the file stop typechecking
    // while still handing the query layer a string.
    const startDate = new Date(String(request.getParam('startDate')))
    const endDate = new Date(String(request.getParam('endDate')))

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()))
      return response.json({ message: 'startDate and endDate must be valid dates.' }, 422)

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
