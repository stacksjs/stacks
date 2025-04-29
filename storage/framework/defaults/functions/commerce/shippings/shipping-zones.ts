import type { ShippingZones } from '../../types'
import { useFetch, useStorage } from '@vueuse/core'

// Create a persistent shipping zones array using VueUse's useStorage
const shippingZones = useStorage<ShippingZones[]>('shippingZones', [])

const baseURL = 'http://localhost:3008/api'

// Basic fetch function to get all shipping zones
async function fetchShippingZones() {
  const { error, data } = useFetch<ShippingZones[]>(`${baseURL}/commerce/shipping-zones`)

  if (error.value) {
    console.error('Error fetching shipping zones:', error.value)
    return []
  }

  // Ensure data is an array before assigning
  if (Array.isArray(data.value)) {
    shippingZones.value = data.value
    return data.value
  }
  else {
    console.error('Expected array of shipping zones but received:', typeof data.value)
    return []
  }
}

async function createShippingZone(shippingZone: ShippingZones) {
  const { error, data } = useFetch<ShippingZones>(`${baseURL}/commerce/shipping-zones`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(shippingZone),
  })

  if (error.value) {
    console.error('Error creating shipping zone:', error.value)
    return null
  }

  if (data.value) {
    shippingZones.value.push(data.value)
    return data.value
  }
  return null
}

async function updateShippingZone(shippingZone: ShippingZones) {
  const { error, data } = useFetch<ShippingZones>(`${baseURL}/commerce/shipping-zones/${shippingZone.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(shippingZone),
  })

  if (error.value) {
    console.error('Error updating shipping zone:', error.value)
    return null
  }

  if (data.value) {
    const index = shippingZones.value.findIndex(s => s.id === shippingZone.id)
    if (index !== -1) {
      shippingZones.value[index] = data.value
    }
    return data.value
  }
  return null
}

async function deleteShippingZone(id: number) {
  const { error } = useFetch(`${baseURL}/commerce/shipping-zones/${id}`, {
    method: 'DELETE',
  })

  if (error.value) {
    console.error('Error deleting shipping zone:', error.value)
    return false
  }

  const index = shippingZones.value.findIndex(s => s.id === id)
  if (index !== -1) {
    shippingZones.value.splice(index, 1)
  }

  return true
}

// Export the composable
export function useShippingZones() {
  return {
    shippingZones,
    fetchShippingZones,
    createShippingZone,
    updateShippingZone,
    deleteShippingZone,
  }
}
