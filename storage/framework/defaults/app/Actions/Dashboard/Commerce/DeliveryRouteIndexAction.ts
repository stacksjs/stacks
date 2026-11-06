import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { parseDeliveryRouteListQuery, readDeliveryRoutePage } from './commerce-delivery-route-list'

/**
 * `GET /api/dashboard/commerce/delivery-routes` - one page of delivery routes,
 * searched, sorted and counted by the database, with the summary of every
 * route (commerce-delivery-route-list.ts, stacksjs/stacks#3218). It used to
 * return the 500 most recently active routes as a bare array.
 */
export default new Action({
  name: 'Dashboard Delivery Routes',
  description: 'Returns one page of delivery routes with their linked couriers.',
  method: 'GET',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const query = parseDeliveryRouteListQuery(key => request.get<unknown>(key, ''))
    if ('error' in query)
      return response.json({ message: query.error }, 422)

    try {
      const routes = await readDeliveryRoutePage(query)
      return {
        records: routes.records,
        total: routes.total,
        page: routes.page,
        perPage: query.perPage,
        summary: routes.summary,
      }
    }
    catch (error) {
      return dashboardOperationalError(error, 'Delivery route records could not be read.', 'DeliveryRouteIndexAction')
    }
  },
})
