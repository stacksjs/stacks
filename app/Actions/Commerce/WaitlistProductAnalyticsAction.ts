import type { WaitlistProductRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { waitlists } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'WaitlistProduct Analytics',
  description: 'WaitlistProduct Analytics Action',
  method: 'GET',
  async handle(request: WaitlistProductRequestType) {
    const startDate = request.getParam<Date>('startDate')
    const endDate = request.getParam<Date>('endDate')

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
