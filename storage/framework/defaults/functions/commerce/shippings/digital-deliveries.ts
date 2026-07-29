import type { DigitalDeliveries } from '../../../types/defaults'
import { createDashboardResource } from './dashboard-resource'

type NewDigitalDelivery = Omit<DigitalDeliveries, 'id'>

const resource = createDashboardResource<DigitalDeliveries, NewDigitalDelivery>({
  path: '/api/dashboard/commerce/digital-deliveries',
  storageKey: 'digitalDeliveries',
  singular: 'digital delivery',
  plural: 'digital deliveries',
})

export function useDigitalDeliveries() {
  return {
    digitalDeliveries: resource.items,
    fetchDigitalDeliveries: resource.fetchAll,
    createDigitalDelivery: resource.create,
    updateDigitalDelivery: resource.update,
    deleteDigitalDelivery: resource.destroy,
  }
}
