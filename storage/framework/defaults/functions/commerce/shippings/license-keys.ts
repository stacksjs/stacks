import type { LicenseKeys, NewLicenseKey } from '../../../types/defaults'
import { useStorage } from '@stacksjs/browser'
import { pushToast } from '../../toasts'

// Create a persistent license keys array using VueUse's useStorage
const licenseKeys = useStorage<LicenseKeys[]>('licenseKeys', [])

const baseURL = process.env.VITE_API_URL || `http://localhost:${process.env.PORT_API || '3008'}`

// Basic fetch function to get all license keys
async function fetchLicenseKeys() {
  try {
    const response = await fetch(`${baseURL}/commerce/license-keys`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const { data } = await response.json() as { data: LicenseKeys[] }

    if (Array.isArray(data)) {
      licenseKeys.value = data
      return data
    }
    else {
      pushToast('error', 'Couldn\'t load license keys', { detail: 'Server returned a non-array response' })
      return []
    }
  }
  catch (error) {
    pushToast('error', 'Error fetching license keys', { detail: String(error) })
    return []
  }
}

async function createLicenseKey(licenseKey: NewLicenseKey) {
  try {
    const response = await fetch(`${baseURL}/commerce/license-keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(licenseKey),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const { data } = await response.json() as { data: LicenseKeys }
    if (data) {
      licenseKeys.value.push(data)
      return data
    }
    return null
  }
  catch (error) {
    pushToast('error', 'Error creating license key', { detail: String(error) })
    return null
  }
}

async function updateLicenseKey(licenseKey: LicenseKeys) {
  try {
    const response = await fetch(`${baseURL}/commerce/license-keys/${licenseKey.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(licenseKey),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const { data } = await response.json() as { data: LicenseKeys }
    if (data) {
      const index = licenseKeys.value.findIndex(s => s.id === licenseKey.id)
      if (index !== -1) {
        licenseKeys.value[index] = data
      }
      return data
    }
    return null
  }
  catch (error) {
    pushToast('error', 'Error updating license key', { detail: String(error) })
    return null
  }
}

async function deleteLicenseKey(id: number) {
  try {
    const response = await fetch(`${baseURL}/commerce/license-keys/${id}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const index = licenseKeys.value.findIndex(s => s.id === id)
    if (index !== -1) {
      licenseKeys.value.splice(index, 1)
    }

    return true
  }
  catch (error) {
    pushToast('error', 'Error deleting license key', { detail: String(error) })
    return false
  }
}

// Export the composable
export function useLicenseKeys() {
  return {
    licenseKeys,
    fetchLicenseKeys,
    createLicenseKey,
    updateLicenseKey,
    deleteLicenseKey,
  }
}
