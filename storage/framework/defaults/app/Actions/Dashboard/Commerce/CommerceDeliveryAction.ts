import { Action } from '@stacksjs/actions'
import { config } from '@stacksjs/config'
import { DeliveryRoute, Driver, ShippingMethod, ShippingZone } from '@stacksjs/orm'
import { buildDeliveryOverview } from './commerce-delivery'

export default new Action({
  name: 'CommerceDelivery',
  description: 'Returns the dashboard delivery overview from routes, drivers, shipping methods, and zones.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    const [allMethods, allRoutes, allZones, allDrivers] = await Promise.all([
      ShippingMethod.all(),
      DeliveryRoute.all(),
      ShippingZone.all(),
      Driver.all(),
    ])

    return buildDeliveryOverview(
      allMethods,
      allRoutes,
      allZones,
      allDrivers,
      String((config as any).commerce?.currency || 'USD').toUpperCase(),
    )
  },
})
