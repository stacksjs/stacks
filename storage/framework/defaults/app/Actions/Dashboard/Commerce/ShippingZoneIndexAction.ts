import { Action } from '@stacksjs/actions/runtime'
import { ShippingMethod, ShippingZone } from '@stacksjs/orm'
import { dashboardOperationalError } from '../dashboard-response'
import {
  indexShippingZoneMethods,
  normalizeShippingZoneRecord,
} from './shipping-zone-records'

export default new Action({
  name: 'Dashboard Shipping Zones',
  description: 'Returns validated shipping zones and their method relationships.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    try {
      // Read whole: store configuration, which the page searches in full. The
      // first 500 left the rest unlisted and unsearchable (stacksjs/stacks#3218).
      const zones = await ShippingZone.orderBy('name', 'asc').get()
      const methodIds = [...new Set(zones.map(zone => zone.get('shipping_method_id')).filter(Boolean))]
      const methods = methodIds.length
        ? await ShippingMethod.whereIn('id', methodIds).get()
        : []
      const methodsById = indexShippingZoneMethods(methods)
      return zones.map(zone => normalizeShippingZoneRecord(zone, methodsById))
    }
    catch (error) {
      return dashboardOperationalError(error, 'Shipping zone records could not be read.', 'ShippingZoneIndexAction')
    }
  },
})
