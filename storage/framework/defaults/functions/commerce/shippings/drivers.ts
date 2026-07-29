import type { Drivers, NewDriver } from '../../../types/defaults'
import { createDashboardResource } from './dashboard-resource'

const resource = createDashboardResource<Drivers, NewDriver>({
  path: '/api/dashboard/commerce/drivers',
  storageKey: 'drivers',
  singular: 'driver',
  plural: 'drivers',
})

export function useDrivers() {
  return {
    drivers: resource.items,
    fetchDrivers: resource.fetchAll,
    createDriver: resource.create,
    updateDriver: resource.update,
    deleteDriver: resource.destroy,
  }
}
