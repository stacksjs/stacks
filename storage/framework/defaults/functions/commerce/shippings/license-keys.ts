import type { LicenseKeys, NewLicenseKey } from '../../../types/defaults'
import { dashboardApi } from '../../dashboard-api'
import { createDashboardResource } from './dashboard-resource'
import { useStorage } from '@stacksjs/browser/composables/useStorage'

interface LicenseKeyOption {
  id: number
  label: string
  detail?: string
}

interface LicenseKeyOptions {
  customers: LicenseKeyOption[]
  products: LicenseKeyOption[]
  orders: LicenseKeyOption[]
}

const resource = createDashboardResource<LicenseKeys, NewLicenseKey>({
  path: '/api/dashboard/commerce/license-keys',
  storageKey: 'licenseKeys',
  singular: 'license key',
  plural: 'license keys',
})

const options = useStorage<LicenseKeyOptions>('licenseKeyOptions', {
  customers: [],
  products: [],
  orders: [],
})

async function fetchLicenseKeyOptions(): Promise<LicenseKeyOptions> {
  const result = await dashboardApi<LicenseKeyOptions>('/api/dashboard/commerce/license-key-options')
  options.value = result
  return result
}

export function useLicenseKeys() {
  return {
    licenseKeys: resource.items,
    licenseKeyOptions: options,
    fetchLicenseKeys: resource.fetchAll,
    fetchLicenseKeyOptions,
    createLicenseKey: resource.create,
    updateLicenseKey: resource.update,
    deleteLicenseKey: resource.destroy,
  }
}
