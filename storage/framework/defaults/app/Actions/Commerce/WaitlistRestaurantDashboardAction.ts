import { Action } from '@stacksjs/actions'
import { waitlists } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'WaitlistRestaurant Dashboard',
  description: 'Get restaurant dashboard statistics',
  method: 'GET',
  async handle() {
    const [
      waitTimeStats,
      seatedStats,
      noShowStats,
      timeSeriesStats,
    ] = await Promise.all([
      waitlists.restaurant.fetchCurrentWaitTimes(),
      waitlists.restaurant.fetchSeatedStats(),
      waitlists.restaurant.fetchNoShowStats(new Date(Date.now() - 24 * 60 * 60 * 1000), new Date()),
      waitlists.restaurant.fetchTimeSeriesStats(),
    ])

    return response.json({
      waitTimeStats,
      seatedStats,
      noShowStats,
      timeSeriesStats,
    })
  },
})
