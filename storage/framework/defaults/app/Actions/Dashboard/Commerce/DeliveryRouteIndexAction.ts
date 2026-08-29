import { Action } from '@stacksjs/actions'
import { DeliveryRoute, Courier } from '@stacksjs/orm'
import { dashboardOperationalError } from '../dashboard-response'
import {
  indexDeliveryRouteCouriers,
  normalizeDeliveryRouteRecord,
} from './delivery-route-records'

export default new Action({
  name: 'Dashboard Delivery Routes',
  description: 'Returns validated delivery routes and their optional Courier relationships.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    try {
      const routes = await DeliveryRoute.orderByDesc('last_active').limit(500).get()
      const courierIds = [...new Set(routes.map(route => route.get('courier_id')).filter(Boolean))]
      const couriers = courierIds.length ? await Courier.whereIn('id', courierIds).get() : []
      const couriersById = indexDeliveryRouteCouriers(couriers)
      return routes.map(route => normalizeDeliveryRouteRecord(route, couriersById))
    }
    catch (error) {
      return dashboardOperationalError(error, 'Delivery route records could not be read.', 'DeliveryRouteIndexAction')
    }
  },
})
