import { Action } from '@stacksjs/actions'
import { DeliveryRoute, Driver } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import {
  indexDeliveryRouteDrivers,
  normalizeDeliveryRouteRecord,
} from './delivery-route-records'

export default new Action({
  name: 'Dashboard Delivery Routes',
  description: 'Returns validated delivery routes and their optional Driver relationships.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    try {
      const routes = await DeliveryRoute.orderByDesc('last_active').limit(500).get()
      const driverIds = [...new Set(routes.map(route => route.get('driver_id')).filter(Boolean))]
      const drivers = driverIds.length ? await Driver.where('id', 'in', driverIds).get() : []
      const driversById = indexDeliveryRouteDrivers(drivers)
      return routes.map(route => normalizeDeliveryRouteRecord(route, driversById))
    }
    catch (error) {
      return response.json({
        message: error instanceof Error ? error.message : 'Delivery route records could not be read.',
      }, 503)
    }
  },
})
