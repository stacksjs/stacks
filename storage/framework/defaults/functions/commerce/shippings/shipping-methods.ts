import type { ShippingMethods } from '../../types'
import { useFetch, useStorage } from '@vueuse/core'

// Create a persistent shipping methods array using VueUse's useStorage
const shippingMethods = useStorage<ShippingMethods[]>('shippingMethods', [])

const baseURL = 'http://localhost:3008/api'

// Basic fetch function to get all shipping methods
async function fetchShippingMethods() {
  const { error, data } = useFetch<ShippingMethods[]>(`${baseURL}/commerce/shipping-methods`)

  if (error.value) {
    console.error('Error fetching shipping methods:', error.value)
    return []
  }

  // Ensure data is an array before assigning
  if (Array.isArray(data.value)) {
    shippingMethods.value = data.value
    return data.value
  }
  else {
    console.error('Expected array of shipping methods but received:', typeof data.value)
    return []
  }
}

async function createShippingMethod(shippingMethod: ShippingMethods) {
  const { error, data } = useFetch<ShippingMethods>(`${baseURL}/commerce/shipping-methods`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(shippingMethod),
  })

  if (error.value) {
    console.error('Error creating shipping method:', error.value)
    return null
  }

  if (data.value) {
    shippingMethods.value.push(data.value)
    return data.value
  }
  return null
}

async function updateShippingMethod(shippingMethod: ShippingMethods) {
  const { error, data } = useFetch<ShippingMethods>(`${baseURL}/commerce/shipping-methods/${shippingMethod.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(shippingMethod),
  })

  if (error.value) {
    console.error('Error updating shipping method:', error.value)
    return null
  }

  if (data.value) {
    const index = shippingMethods.value.findIndex(s => s.id === shippingMethod.id)
    if (index !== -1) {
      shippingMethods.value[index] = data.value
    }
    return data.value
  }
  return null
}

async function deleteShippingMethod(id: number) {
  const { error } = useFetch(`${baseURL}/commerce/shipping-methods/${id}`, {
    method: 'DELETE',
  })

  if (error.value) {
    console.error('Error deleting shipping method:', error.value)
    return false
  }

  const index = shippingMethods.value.findIndex(s => s.id === id)
  if (index !== -1) {
    shippingMethods.value.splice(index, 1)
  }

  return true
}

// Export the composable
export function useShippingMethods() {
  return {
    shippingMethods,
    fetchShippingMethods,
    createShippingMethod,
    updateShippingMethod,
    deleteShippingMethod,
  }
}
