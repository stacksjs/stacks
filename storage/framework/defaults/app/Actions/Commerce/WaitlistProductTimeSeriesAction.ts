import { Action } from '@stacksjs/actions'
import { waitlists } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'WaitlistProduct Time Series',
  description: 'WaitlistProduct Time Series Action',
  method: 'GET',
  async handle(request: RequestInstance) {
    // Params arrive as strings; `getParam` has no type parameter to change that.
    const startDate = new Date(String(request.getParam('startDate')))
    const endDate = new Date(String(request.getParam('endDate')))

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()))
      return response.json({ message: 'startDate and endDate must be valid dates.' }, 422)

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
