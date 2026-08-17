import { Action } from '@stacksjs/actions'
import { waitlists } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'WaitlistProduct Analytics',
  description: 'WaitlistProduct Analytics Action',
  method: 'GET',
  async handle(request: RequestInstance) {
    // Params arrive as strings; `getParam` has no type parameter to change that.
    const startDate = new Date(String(request.getParam('startDate')))
    const endDate = new Date(String(request.getParam('endDate')))

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()))
      return response.json({ message: 'startDate and endDate must be valid dates.' }, 422)

    const [
      countBySource,
      countByAllQuantities,
      conversionRates,
    ] = await Promise.all([
      waitlists.products.fetchCountBySource(startDate, endDate),
      waitlists.products.fetchCountByAllQuantities(startDate, endDate),
      waitlists.products.fetchConversionRates(startDate, endDate),
    ])

    return response.json({
      countBySource,
      countByAllQuantities,
      conversionRates,
    })
  },
})
