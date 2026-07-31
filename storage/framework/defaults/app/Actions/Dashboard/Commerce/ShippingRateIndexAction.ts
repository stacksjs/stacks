import { Action } from '@stacksjs/actions'
import { ShippingMethod, ShippingRate, ShippingZone } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import {
  indexShippingRateMethods,
  indexShippingRateZones,
  normalizeShippingRateRecord,
} from './shipping-rate-records'

export default new Action({
  name: 'Dashboard Shipping Rates',
  description: 'Returns validated shipping rates with their method and zone relationships.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    try {
      const rates = await ShippingRate.orderBy('weight_from', 'asc').limit(500).get()
      const methodIds = [...new Set(rates.map(rate => rate.get('shipping_method_id')).filter(Boolean))]
      const zoneIds = [...new Set(rates.map(rate => rate.get('shipping_zone_id')).filter(Boolean))]
      const [methods, zones] = await Promise.all([
        methodIds.length ? ShippingMethod.where('id', 'in', methodIds).get() : [],
        zoneIds.length ? ShippingZone.where('id', 'in', zoneIds).get() : [],
      ])
      const methodsById = indexShippingRateMethods(methods)
      const zonesById = indexShippingRateZones(zones)
      return rates.map(rate => normalizeShippingRateRecord(rate, methodsById, zonesById))
    }
    catch (error) {
      return response.json({
        message: error instanceof Error ? error.message : 'Shipping rate records could not be read.',
      }, 503)
    }
  },
})
