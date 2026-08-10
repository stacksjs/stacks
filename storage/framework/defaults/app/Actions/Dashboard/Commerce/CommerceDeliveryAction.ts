import { Action } from '@stacksjs/actions'
import { config } from '@stacksjs/config'
import { DeliveryRoute, Driver, ShippingMethod, ShippingZone } from '@stacksjs/orm'
import { dashboardOperationalError } from '../dashboard-response'
import { buildDeliveryOverview } from './commerce-delivery'

export default new Action({
  name: 'CommerceDelivery',
  description: 'Returns the dashboard delivery overview from routes, drivers, shipping methods, and zones.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    try {
      const [allMethods, allRoutes, allZones, allDrivers] = await Promise.all([
        ShippingMethod.orderBy('id', 'asc').limit(500).get(),
        DeliveryRoute.orderBy('id', 'asc').limit(500).get(),
        ShippingZone.orderBy('id', 'asc').limit(500).get(),
        Driver.orderBy('id', 'asc').limit(500).get(),
      ])

      return buildDeliveryOverview(
        allMethods,
        allRoutes,
        allZones,
        allDrivers,
        (config as any).commerce?.currency,
      )
    }
    catch (error) {
      return dashboardOperationalError(error, 'Delivery records could not be read.', 'CommerceDeliveryAction')
    }
  },
})
