import type { Couriers, NewCourier } from '../../../types/defaults'
import { createDashboardResource } from './dashboard-resource'

const resource = createDashboardResource<Couriers, NewCourier>({
  path: '/api/dashboard/commerce/couriers',
  storageKey: 'couriers',
  singular: 'courier',
  plural: 'couriers',
})

export function useCouriers() {
  return {
    couriers: resource.items,
    fetchCouriers: resource.fetchAll,
    createCourier: resource.create,
    updateCourier: resource.update,
    deleteCourier: resource.destroy,
  }
}
