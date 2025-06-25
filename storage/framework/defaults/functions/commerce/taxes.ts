import type { TaxRates } from '../../types/defaults'
import { useStorage } from '@vueuse/core'

// Create a persistent tax rates array using VueUse's useStorage
const taxRates = useStorage<TaxRates[]>('taxRates', [])

const baseURL = 'http://localhost:3008/api'

// Basic fetch function to get all tax rates
async function fetchTaxRates() {
  try {
    const response = await fetch(`${baseURL}/commerce/tax-rates`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.json() as TaxRates[]

    if (Array.isArray(data)) {
      taxRates.value = data
      return data
    }
    else {
      console.error('Expected array of tax rates but received:', typeof data)
      return []
    }
  }
  catch (error) {
    console.error('Error fetching tax rates:', error)
    return []
  }
}

async function createTaxRate(taxRate: TaxRates) {
  try {
    const response = await fetch(`${baseURL}/commerce/tax-rates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(taxRate),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json() as TaxRates
    if (data) {
      taxRates.value.push(data)
      return data
    }
    return null
  }
  catch (error) {
    console.error('Error creating tax rate:', error)
    return null
  }
}

async function updateTaxRate(taxRate: TaxRates) {
  try {
    const response = await fetch(`${baseURL}/commerce/tax-rates/${taxRate.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(taxRate),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json() as TaxRates
    if (data) {
      const index = taxRates.value.findIndex(t => t.id === taxRate.id)
      if (index !== -1) {
        taxRates.value[index] = data
      }
      return data
    }
    return null
  }
  catch (error) {
    console.error('Error updating tax rate:', error)
    return null
  }
}

async function deleteTaxRate(id: number) {
  try {
    const response = await fetch(`${baseURL}/commerce/tax-rates/${id}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const index = taxRates.value.findIndex(t => t.id === id)
    if (index !== -1) {
      taxRates.value.splice(index, 1)
    }

    return true
  }
  catch (error) {
    console.error('Error deleting tax rate:', error)
    return false
  }
}

// Export the composable
export function useTaxRates() {
  return {
    taxRates,
    fetchTaxRates,
    createTaxRate,
    updateTaxRate,
    deleteTaxRate,
  }
}
