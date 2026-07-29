import type { LicenseKeys, NewLicenseKey } from '../../../types/defaults'
import { createDashboardResource } from './dashboard-resource'

const resource = createDashboardResource<LicenseKeys, NewLicenseKey>({
  path: '/api/dashboard/commerce/license-keys',
  storageKey: 'licenseKeys',
  singular: 'license key',
  plural: 'license keys',
})

export function useLicenseKeys() {
  return {
    licenseKeys: resource.items,
    fetchLicenseKeys: resource.fetchAll,
    createLicenseKey: resource.create,
    updateLicenseKey: resource.update,
    deleteLicenseKey: resource.destroy,
  }
}
