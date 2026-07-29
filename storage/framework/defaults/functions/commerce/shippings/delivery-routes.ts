import type { DeliveryRoutes, NewDeliveryRoute } from '../../../types/defaults'
import { createDashboardResource } from './dashboard-resource'

const resource = createDashboardResource<DeliveryRoutes, NewDeliveryRoute>({
  path: '/api/dashboard/commerce/delivery-routes',
  storageKey: 'deliveryRoutes',
  singular: 'delivery route',
  plural: 'delivery routes',
})

export function useDeliveryRoutes() {
  return {
    deliveryRoutes: resource.items,
    fetchDeliveryRoutes: resource.fetchAll,
    createDeliveryRoute: resource.create,
    updateDeliveryRoute: resource.update,
    deleteDeliveryRoute: resource.destroy,
  }
}
