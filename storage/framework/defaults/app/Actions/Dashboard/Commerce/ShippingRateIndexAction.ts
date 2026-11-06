import { Action } from '@stacksjs/actions/runtime'
import { ShippingMethod, ShippingRate, ShippingZone } from '@stacksjs/orm'
import { dashboardOperationalError } from '../dashboard-response'
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
      // Read whole: store configuration, which the page searches in full. The
      // first 500 left the rest unlisted and unsearchable (stacksjs/stacks#3218).
      const rates = await ShippingRate.orderBy('weight_from', 'asc').get()
      const methodIds = [...new Set(rates.map(rate => rate.get('shipping_method_id')).filter(Boolean))]
      const zoneIds = [...new Set(rates.map(rate => rate.get('shipping_zone_id')).filter(Boolean))]
      const [methods, zones] = await Promise.all([
        methodIds.length ? ShippingMethod.whereIn('id', methodIds).get() : [],
        zoneIds.length ? ShippingZone.whereIn('id', zoneIds).get() : [],
      ])
      const methodsById = indexShippingRateMethods(methods)
      const zonesById = indexShippingRateZones(zones)
      return rates.map(rate => normalizeShippingRateRecord(rate, methodsById, zonesById))
    }
    catch (error) {
      return dashboardOperationalError(error, 'Shipping rate records could not be read.', 'ShippingRateIndexAction')
    }
  },
})
