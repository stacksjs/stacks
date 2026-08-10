import { Action } from '@stacksjs/actions'
import { DeliveryRoute, Driver } from '@stacksjs/orm'
import { dashboardOperationalError } from '../dashboard-response'
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
      return dashboardOperationalError(error, 'Delivery route records could not be read.', 'DeliveryRouteIndexAction')
    }
  },
})
