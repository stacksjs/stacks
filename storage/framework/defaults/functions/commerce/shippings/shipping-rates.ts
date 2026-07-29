import type { NewShippingRate, ShippingRates } from '../../../types/defaults'
import { createDashboardResource } from './dashboard-resource'

const resource = createDashboardResource<ShippingRates, NewShippingRate>({
  path: '/api/dashboard/commerce/shipping-rates',
  storageKey: 'shippingRates',
  singular: 'shipping rate',
  plural: 'shipping rates',
})

export function useShippingRates() {
  return {
    shippingRates: resource.items,
    fetchShippingRates: resource.fetchAll,
    createShippingRate: resource.create,
    updateShippingRate: resource.update,
    deleteShippingRate: resource.destroy,
  }
}
