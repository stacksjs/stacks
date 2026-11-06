import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { parseRestaurantWaitlistListQuery, readRestaurantWaitlistPage } from './commerce-restaurant-waitlist-list'

/**
 * `GET /api/dashboard/commerce/waitlist-restaurants` - one page of the
 * restaurant waitlist, searched, filtered, sorted and counted by the database,
 * with the summary of every party (commerce-restaurant-waitlist-list.ts,
 * stacksjs/stacks#3218). The entry dialog searches its customers itself
 * (commerce-choices.ts); this used to send the first 500.
 */
export default new Action({
  name: 'RestaurantWaitlistIndexAction',
  description: 'Return one page of native restaurant waitlist records for the dashboard',
  method: 'GET',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const query = parseRestaurantWaitlistListQuery(key => request.get<unknown>(key, ''))
    if ('error' in query)
      return response.json({ message: query.error }, 422)

    try {
      const parties = await readRestaurantWaitlistPage(query)
      return {
        records: parties.records,
        total: parties.total,
        page: parties.page,
        perPage: query.perPage,
        summary: parties.summary,
      }
    }
    catch (error) {
      return dashboardOperationalError(error, 'Restaurant waitlist records could not be read.', 'RestaurantWaitlistIndexAction')
    }
  },
})
