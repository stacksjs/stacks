import type { NewShippingZone, ShippingZones } from '../../../types/defaults'
import { createDashboardResource } from './dashboard-resource'

const resource = createDashboardResource<ShippingZones, NewShippingZone>({
  path: '/api/dashboard/commerce/shipping-zones',
  storageKey: 'shippingZones',
  singular: 'shipping zone',
  plural: 'shipping zones',
})

export function useShippingZones() {
  return {
    shippingZones: resource.items,
    fetchShippingZones: resource.fetchAll,
    createShippingZone: resource.create,
    updateShippingZone: resource.update,
    deleteShippingZone: resource.destroy,
  }
}
