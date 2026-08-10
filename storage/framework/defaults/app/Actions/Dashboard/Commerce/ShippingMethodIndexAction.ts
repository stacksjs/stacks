import { Action } from '@stacksjs/actions'
import { ShippingMethod, ShippingZone } from '@stacksjs/orm'
import { dashboardOperationalError } from '../dashboard-response'
import {
  groupShippingMethodZones,
  normalizeShippingMethodRecord,
  shippingMethodIds,
} from './shipping-method-records'

export default new Action({
  name: 'Dashboard Shipping Methods',
  description: 'Returns validated shipping methods and their zone summaries.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    try {
      const methods = await ShippingMethod.orderBy('name', 'asc').limit(500).get()
      const methodIds = shippingMethodIds(methods)
      const zones = methodIds.size
        ? await ShippingZone.where('shipping_method_id', 'in', [...methodIds]).orderBy('name', 'asc').get()
        : []
      const zonesByMethodId = groupShippingMethodZones(zones, methodIds)
      return methods.map(method => normalizeShippingMethodRecord(method, zonesByMethodId))
    }
    catch (error) {
      return dashboardOperationalError(error, 'Shipping method records could not be read.', 'ShippingMethodIndexAction')
    }
  },
})
