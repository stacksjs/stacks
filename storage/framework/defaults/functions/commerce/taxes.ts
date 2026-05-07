import type { TaxRates } from '../../types/defaults'
import { useStorage } from '@stacksjs/browser'
import { pushToast } from '../toasts'

// Create a persistent tax rates array using VueUse's useStorage
const taxRates = useStorage<TaxRates[]>('taxRates', [])

const baseURL = process.env.VITE_API_URL || `http://localhost:${process.env.PORT_API || '3008'}`

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
      pushToast('error', 'Couldn\'t load tax rates', { detail: `Expected array but received ${typeof data}` })
      return []
    }
  }
  catch (error) {
    pushToast('error', 'Couldn\'t load tax rates', { detail: String(error) })
    return taxRates.value
  }
}

async function createTaxRate(taxRate: TaxRates) {
  try {
    const response = await fetch(`${baseURL}/commerce/tax-rates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(taxRate),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json() as TaxRates
    if (data) {
      taxRates.value.push(data)
      pushToast('success', 'Tax rate created')
      return data
    }
    return null
  }
  catch (error) {
    pushToast('error', 'Failed to create tax rate', { detail: String(error) })
    return null
  }
}

async function updateTaxRate(taxRate: TaxRates) {
  try {
    const response = await fetch(`${baseURL}/commerce/tax-rates/${taxRate.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
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
      pushToast('success', 'Tax rate updated')
      return data
    }
    return null
  }
  catch (error) {
    pushToast('error', 'Failed to update tax rate', { detail: String(error) })
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
    pushToast('success', 'Tax rate deleted')
    return true
  }
  catch (error) {
    pushToast('error', 'Failed to delete tax rate', { detail: String(error) })
    return false
  }
}

export function useTaxRates() {
  return {
    taxRates,
    fetchTaxRates,
    createTaxRate,
    updateTaxRate,
    deleteTaxRate,
  }
}
