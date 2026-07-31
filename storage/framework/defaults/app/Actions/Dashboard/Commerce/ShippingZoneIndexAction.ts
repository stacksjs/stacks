import { Action } from '@stacksjs/actions'
import { ShippingMethod, ShippingZone } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
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
      const zones = await ShippingZone.orderBy('name', 'asc').limit(500).get()
      const methodIds = [...new Set(zones.map(zone => zone.get('shipping_method_id')).filter(Boolean))]
      const methods = methodIds.length
        ? await ShippingMethod.where('id', 'in', methodIds).get()
        : []
      const methodsById = indexShippingZoneMethods(methods)
      return zones.map(zone => normalizeShippingZoneRecord(zone, methodsById))
    }
    catch (error) {
      return response.json({
        message: error instanceof Error ? error.message : 'Shipping zone records could not be read.',
      }, 503)
    }
  },
})
