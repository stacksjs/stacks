import { Action } from '@stacksjs/actions/runtime'
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
      // Read whole: store configuration, which the page searches in full. The
      // first 500 left the rest unlisted and unsearchable (stacksjs/stacks#3218).
      const methods = await ShippingMethod.orderBy('name', 'asc').get()
      const methodIds = shippingMethodIds(methods)
      const zones = methodIds.size
        ? await ShippingZone.whereIn('shipping_method_id', [...methodIds]).orderBy('name', 'asc').get()
        : []
      const zonesByMethodId = groupShippingMethodZones(zones, methodIds)
      return methods.map(method => normalizeShippingMethodRecord(method, zonesByMethodId))
    }
    catch (error) {
      return dashboardOperationalError(error, 'Shipping method records could not be read.', 'ShippingMethodIndexAction')
    }
  },
})
