import type { NewShippingMethod, ShippingMethods } from '../../../types/defaults'
import { useStorage } from '@vueuse/core'

// Create a persistent shipping methods array using VueUse's useStorage
const shippingMethods = useStorage<ShippingMethods[]>('shippingMethods', [])

const baseURL = 'http://localhost:3008'

// Basic fetch function to get all shipping methods
async function fetchShippingMethods() {
  try {
    const response = await fetch(`${baseURL}/commerce/shipping-methods`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const { data } = await response.json() as { data: ShippingMethods[] }

    if (Array.isArray(data)) {
      shippingMethods.value = data
      return data
    }
    else {
      console.error('Expected array of shipping methods but received:', typeof data)
      return []
    }
  }
  catch (error) {
    console.error('Error fetching shipping methods:', error)
    return []
  }
}

async function createShippingMethod(shippingMethod: NewShippingMethod) {
  try {
    const response = await fetch(`${baseURL}/commerce/shipping-methods`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(shippingMethod),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json() as ShippingMethods
    if (data) {
      shippingMethods.value.push(data)
      return data
    }
    return null
  }
  catch (error) {
    console.error('Error creating shipping method:', error)
    return null
  }
}

async function updateShippingMethod(shippingMethod: ShippingMethods) {
  try {
    const response = await fetch(`${baseURL}/commerce/shipping-methods/${shippingMethod.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(shippingMethod),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json() as ShippingMethods
    if (data) {
      const index = shippingMethods.value.findIndex(s => s.id === shippingMethod.id)
      if (index !== -1) {
        shippingMethods.value[index] = data
      }
      return data
    }
    return null
  }
  catch (error) {
    console.error('Error updating shipping method:', error)
    return null
  }
}

async function deleteShippingMethod(id: number) {
  try {
    const response = await fetch(`${baseURL}/commerce/shipping-methods/${id}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const index = shippingMethods.value.findIndex(s => s.id === id)
    if (index !== -1) {
      shippingMethods.value.splice(index, 1)
    }

    return true
  }
  catch (error) {
    console.error('Error deleting shipping method:', error)
    return false
  }
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
