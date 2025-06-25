import type { NewShippingRate, ShippingRates } from '../../../types/defaults'
import { useStorage } from '@vueuse/core'

// Create a persistent shipping rates array using VueUse's useStorage
const shippingRates = useStorage<ShippingRates[]>('shippingRates', [])

const baseURL = 'http://localhost:3008'

// Basic fetch function to get all shipping rates
async function fetchShippingRates() {
  try {
    const response = await fetch(`${baseURL}/commerce/shipping-rates`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const { data } = await response.json() as { data: ShippingRates[] }

    shippingRates.value = data

    return data
  }
  catch (error) {
    console.error('Error fetching shipping rates:', error)
    return []
  }
}

async function createShippingRate(shippingRate: NewShippingRate) {
  try {
    const response = await fetch(`${baseURL}/commerce/shipping-rates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(shippingRate),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json() as ShippingRates
    if (data) {
      shippingRates.value.push(data)
      return data
    }
    return null
  }
  catch (error) {
    console.error('Error creating shipping rate:', error)
    return null
  }
}

async function updateShippingRate(shippingRate: ShippingRates) {
  try {
    const response = await fetch(`${baseURL}/commerce/shipping-rates/${shippingRate.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(shippingRate),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json() as ShippingRates
    if (data) {
      const index = shippingRates.value.findIndex(s => s.id === shippingRate.id)
      if (index !== -1) {
        shippingRates.value[index] = data
      }
      return data
    }
    return null
  }
  catch (error) {
    console.error('Error updating shipping rate:', error)
    return null
  }
}

async function deleteShippingRate(id: number) {
  try {
    const response = await fetch(`${baseURL}/commerce/shipping-rates/${id}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const index = shippingRates.value.findIndex(s => s.id === id)
    if (index !== -1) {
      shippingRates.value.splice(index, 1)
    }

    return true
  }
  catch (error) {
    console.error('Error deleting shipping rate:', error)
    return false
  }
}

// Export the composable
export function useShippingRates() {
  return {
    shippingRates,
    fetchShippingRates,
    createShippingRate,
    updateShippingRate,
    deleteShippingRate,
  }
}
