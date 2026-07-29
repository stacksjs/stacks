import type { NewShippingMethod, ShippingMethods } from '../../../types/defaults'
import { createDashboardResource } from './dashboard-resource'

const resource = createDashboardResource<ShippingMethods, NewShippingMethod>({
  path: '/api/dashboard/commerce/shipping-methods',
  storageKey: 'shippingMethods',
  singular: 'shipping method',
  plural: 'shipping methods',
})

export function useShippingMethods() {
  return {
    shippingMethods: resource.items,
    fetchShippingMethods: resource.fetchAll,
    createShippingMethod: resource.create,
    updateShippingMethod: resource.update,
    deleteShippingMethod: resource.destroy,
  }
}
