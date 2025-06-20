import type { LicenseTemplates } from '../../types'
import { useStorage } from '@vueuse/core'

// Create a persistent license templates array using VueUse's useStorage
const licenseTemplates = useStorage<LicenseTemplates[]>('licenseTemplates', [])

const baseURL = 'http://localhost:3008'

// Basic fetch function to get all license templates
async function fetchLicenseTemplates() {
  try {
    const response = await fetch(`${baseURL}/commerce/license-templates`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const { data } = await response.json() as { data: LicenseTemplates[] }

    if (Array.isArray(data)) {
      licenseTemplates.value = data
      return data
    }
    else {
      console.error('Expected array of license templates but received:', typeof data)
      return []
    }
  }
  catch (error) {
    console.error('Error fetching license templates:', error)
    return []
  }
}

async function createLicenseTemplate(licenseTemplate: Omit<LicenseTemplates, 'id'>) {
  try {
    const response = await fetch(`${baseURL}/commerce/license-templates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(licenseTemplate),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const { data } = await response.json() as { data: LicenseTemplates }
    if (data) {
      licenseTemplates.value.push(data)
      return data
    }
    return null
  }
  catch (error) {
    console.error('Error creating license template:', error)
    return null
  }
}

async function updateLicenseTemplate(licenseTemplate: LicenseTemplates) {
  try {
    const response = await fetch(`${baseURL}/commerce/license-templates/${licenseTemplate.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(licenseTemplate),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const { data } = await response.json() as { data: LicenseTemplates }
    if (data) {
      const index = licenseTemplates.value.findIndex(s => s.id === licenseTemplate.id)
      if (index !== -1) {
        licenseTemplates.value[index] = data
      }
      return data
    }
    return null
  }
  catch (error) {
    console.error('Error updating license template:', error)
    return null
  }
}

async function deleteLicenseTemplate(id: number) {
  try {
    const response = await fetch(`${baseURL}/commerce/license-templates/${id}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const index = licenseTemplates.value.findIndex(s => s.id === id)
    if (index !== -1) {
      licenseTemplates.value.splice(index, 1)
    }

    return true
  }
  catch (error) {
    console.error('Error deleting license template:', error)
    return false
  }
}

// Export the composable
export function useLicenseTemplates() {
  return {
    licenseTemplates,
    fetchLicenseTemplates,
    createLicenseTemplate,
    updateLicenseTemplate,
    deleteLicenseTemplate,
  }
} 