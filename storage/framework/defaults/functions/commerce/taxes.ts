import type { TaxRates } from '../types'
import { useFetch, useStorage } from '@vueuse/core'

// Create a persistent tax rates array using VueUse's useStorage
const taxRates = useStorage<TaxRates[]>('taxRates', [])

const baseURL = 'http://localhost:3008/api'

// Basic fetch function to get all tax rates
async function fetchTaxRates() {
  const { error, data } = useFetch<TaxRates[]>(`${baseURL}/commerce/tax-rates`)

  if (error.value) {
    console.error('Error fetching tax rates:', error.value)
    return []
  }

  // Ensure data is an array before assigning
  if (Array.isArray(data.value)) {
    taxRates.value = data.value
    return data.value
  }
  else {
    console.error('Expected array of tax rates but received:', typeof data.value)
    return []
  }
}

async function createTaxRate(taxRate: TaxRates) {
  const { error, data } = useFetch<TaxRates>(`${baseURL}/commerce/tax-rates`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(taxRate),
  })

  if (error.value) {
    console.error('Error creating tax rate:', error.value)
    return null
  }

  if (data.value) {
    taxRates.value.push(data.value)
    return data.value
  }
  return null
}

async function updateTaxRate(taxRate: TaxRates) {
  const { error, data } = useFetch<TaxRates>(`${baseURL}/commerce/tax-rates/${taxRate.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(taxRate),
  })

  if (error.value) {
    console.error('Error updating tax rate:', error.value)
    return null
  }

  if (data.value) {
    const index = taxRates.value.findIndex(t => t.id === taxRate.id)
    if (index !== -1) {
      taxRates.value[index] = data.value
    }
    return data.value
  }
  return null
}

async function deleteTaxRate(id: number) {
  const { error } = useFetch(`${baseURL}/commerce/tax-rates/${id}`, {
    method: 'DELETE',
  })

  if (error.value) {
    console.error('Error deleting tax rate:', error.value)
    return false
  }

  const index = taxRates.value.findIndex(t => t.id === id)
  if (index !== -1) {
    taxRates.value.splice(index, 1)
  }

  return true
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
