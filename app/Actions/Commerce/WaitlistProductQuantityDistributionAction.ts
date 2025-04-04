import type { WaitlistProductRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { waitlists } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'WaitlistProduct Quantity Distribution',
  description: 'WaitlistProduct Quantity Distribution Action',
  method: 'GET',
  async handle(request: WaitlistProductRequestType) {
    const startDate = request.getParam<Date>('startDate')
    const endDate = request.getParam<Date>('endDate')

    const quantityDistribution = await waitlists.products.fetchCountByAllQuantities(startDate, endDate)

    // Transform the data into a format suitable for the graph
    const data = Object.entries(quantityDistribution).map(([quantity, count]) => ({
      quantity: Number(quantity),
      count,
    }))

    // Sort by quantity for consistent x-axis ordering
    data.sort((a, b) => a.quantity - b.quantity)

    return response.json({
      data,
      // Add some metadata that might be useful for the graph
      totalOrders: Object.values(quantityDistribution).reduce((sum, count) => sum + count, 0),
      minQuantity: Math.min(...data.map(d => d.quantity)),
      maxQuantity: Math.max(...data.map(d => d.quantity)),
    })
  },
})
