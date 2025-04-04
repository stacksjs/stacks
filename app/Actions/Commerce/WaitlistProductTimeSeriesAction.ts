import type { WaitlistProductRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { waitlists } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'WaitlistProduct Time Series',
  description: 'WaitlistProduct Time Series Action',
  method: 'GET',
  async handle(request: WaitlistProductRequestType) {
    const startDate = request.getParam<Date>('startDate')
    const endDate = request.getParam<Date>('endDate')

    const timeSeriesData = await waitlists.products.fetchCountByDateGrouped(startDate, endDate)

    return response.json({
      data: timeSeriesData,
      // Add some metadata that might be useful for the graph
      totalDays: timeSeriesData.length,
      totalWaitlists: timeSeriesData.reduce((sum, { count }) => sum + count, 0),
      averageWaitlistsPerDay: timeSeriesData.length > 0
        ? timeSeriesData.reduce((sum, { count }) => sum + count, 0) / timeSeriesData.length
        : 0,
    })
  },
})
