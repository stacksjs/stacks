import type { ShippingRates } from '../../types'
import { useFetch, useStorage } from '@vueuse/core'

// Create a persistent shipping rates array using VueUse's useStorage
const shippingRates = useStorage<ShippingRates[]>('shippingRates', [])

const baseURL = 'http://localhost:3008/api'

// Basic fetch function to get all shipping rates
async function fetchShippingRates() {
  const { error, data } = useFetch<ShippingRates[]>(`${baseURL}/commerce/shipping-rates`)

  if (error.value) {
    console.error('Error fetching shipping rates:', error.value)
    return []
  }

  // Ensure data is an array before assigning
  if (Array.isArray(data.value)) {
    shippingRates.value = data.value
    return data.value
  }
  else {
    console.error('Expected array of shipping rates but received:', typeof data.value)
    return []
  }
}

async function createShippingRate(shippingRate: ShippingRates) {
  const { error, data } = useFetch<ShippingRates>(`${baseURL}/commerce/shipping-rates`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(shippingRate),
  })

  if (error.value) {
    console.error('Error creating shipping rate:', error.value)
    return null
  }

  if (data.value) {
    shippingRates.value.push(data.value)
    return data.value
  }
  return null
}

async function updateShippingRate(shippingRate: ShippingRates) {
  const { error, data } = useFetch<ShippingRates>(`${baseURL}/commerce/shipping-rates/${shippingRate.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(shippingRate),
  })

  if (error.value) {
    console.error('Error updating shipping rate:', error.value)
    return null
  }

  if (data.value) {
    const index = shippingRates.value.findIndex(s => s.id === shippingRate.id)
    if (index !== -1) {
      shippingRates.value[index] = data.value
    }
    return data.value
  }
  return null
}

async function deleteShippingRate(id: number) {
  const { error } = useFetch(`${baseURL}/commerce/shipping-rates/${id}`, {
    method: 'DELETE',
  })

  if (error.value) {
    console.error('Error deleting shipping rate:', error.value)
    return false
  }

  const index = shippingRates.value.findIndex(s => s.id === id)
  if (index !== -1) {
    shippingRates.value.splice(index, 1)
  }

  return true
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
