import { Action } from '@stacksjs/actions'
import { config } from '@stacksjs/config'
import { DeliveryRoute, Courier, ShippingMethod, ShippingZone } from '@stacksjs/orm'
import { dashboardOperationalError } from '../dashboard-response'
import { buildDeliveryOverview } from './commerce-delivery'

export default new Action({
  name: 'CommerceDelivery',
  description: 'Returns the dashboard delivery overview from routes, couriers, shipping methods, and zones.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    try {
      const [allMethods, allRoutes, allZones, allCouriers] = await Promise.all([
        ShippingMethod.orderBy('id', 'asc').limit(500).get(),
        DeliveryRoute.orderBy('id', 'asc').limit(500).get(),
        ShippingZone.orderBy('id', 'asc').limit(500).get(),
        Courier.orderBy('id', 'asc').limit(500).get(),
      ])

      return buildDeliveryOverview(
        allMethods,
        allRoutes,
        allZones,
        allCouriers,
        config.commerce?.currency,
      )
    }
    catch (error) {
      return dashboardOperationalError(error, 'Delivery records could not be read.', 'CommerceDeliveryAction')
    }
  },
})
