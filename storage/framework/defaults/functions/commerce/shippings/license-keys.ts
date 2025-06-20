import type { LicenseKeys } from '../../types'
import { useStorage } from '@vueuse/core'

// Create a persistent digital deliveries array using VueUse's useStorage
const licenseKeys = useStorage<LicenseKeys[]>('licenseKeys', [])

const baseURL = 'http://localhost:3008'

// Basic fetch function to get all license keys
async function fetchLicenseKeys() {
  try {
    const response = await fetch(`${baseURL}/commerce/license-keys`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.json() as LicenseKeys[]

    if (Array.isArray(data)) {
      licenseKeys.value = data
      return data
    }
    else {
      console.error('Expected array of digital deliveries but received:', typeof data)
      return []
    }
  }
  catch (error) {
    console.error('Error fetching digital deliveries:', error)
    return []
  }
}

async function createLicenseKey(licenseKey: LicenseKeys) {
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

    const data = await response.json() as LicenseKeys
    if (data) {
      licenseKeys.value.push(data)
      return data
    }
    return null
  }
  catch (error) {
    console.error('Error creating license key:', error)
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

    const data = await response.json() as LicenseKeys
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
    console.error('Error updating digital delivery:', error)
    return null
  }
}

async function deleteDigitalDelivery(id: number) {
  try {
    const response = await fetch(`${baseURL}/commerce/digital-deliveries/${id}`, {
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
    console.error('Error deleting digital delivery:', error)
    return false
  }
}

// Export the composable
export function useDigitalDeliveries() {
  return {
    licenseKeys,
    fetchLicenseKeys,
    createLicenseKey,
    updateLicenseKey,
    deleteDigitalDelivery,
  }
}
