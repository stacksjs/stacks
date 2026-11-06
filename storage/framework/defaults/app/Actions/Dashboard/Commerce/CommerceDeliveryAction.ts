import { Action } from '@stacksjs/actions/runtime'
import { config } from '@stacksjs/config'
import { dashboardOperationalError } from '../dashboard-response'
import { readDeliveryOverview } from './commerce-delivery-overview'

/**
 * `GET /api/dashboard/commerce/delivery` - the delivery overview, counted over
 * every courier, route and zone (commerce-delivery-overview.ts,
 * stacksjs/stacks#3218). It used to work from the first 500 of each.
 */
export default new Action({
  name: 'CommerceDelivery',
  description: 'Returns the dashboard delivery overview from routes, couriers, shipping methods, and zones.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    try {
      return await readDeliveryOverview(config.commerce?.currency)
    }
    catch (error) {
      return dashboardOperationalError(error, 'Delivery records could not be read.', 'CommerceDeliveryAction')
    }
  },
})
