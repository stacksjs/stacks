import type { DeliveryRoutes } from '../../../types'
import { useFetch, useStorage } from '@vueuse/core'

// Create a persistent delivery routes array using VueUse's useStorage
const deliveryRoutes = useStorage<DeliveryRoutes[]>('deliveryRoutes', [])

const baseURL = 'http://localhost:3008/api'

// Basic fetch function to get all delivery routes
async function fetchDeliveryRoutes() {
  const { error, data } = useFetch<DeliveryRoutes[]>(`${baseURL}/commerce/delivery-routes`)

  if (error.value) {
    console.error('Error fetching delivery routes:', error.value)
    return []
  }

  // Ensure data is an array before assigning
  if (Array.isArray(data.value)) {
    deliveryRoutes.value = data.value
    return data.value
  }
  else {
    console.error('Expected array of delivery routes but received:', typeof data.value)
    return []
  }
}

async function createDeliveryRoute(deliveryRoute: DeliveryRoutes) {
  const { error, data } = useFetch<DeliveryRoutes>(`${baseURL}/commerce/delivery-routes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(deliveryRoute),
  })

  if (error.value) {
    console.error('Error creating delivery route:', error.value)
    return null
  }

  if (data.value) {
    deliveryRoutes.value.push(data.value)
    return data.value
  }
  return null
}

async function updateDeliveryRoute(deliveryRoute: DeliveryRoutes) {
  const { error, data } = useFetch<DeliveryRoutes>(`${baseURL}/commerce/delivery-routes/${deliveryRoute.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(deliveryRoute),
  })

  if (error.value) {
    console.error('Error updating delivery route:', error.value)
    return null
  }

  if (data.value) {
    const index = deliveryRoutes.value.findIndex(s => s.id === deliveryRoute.id)
    if (index !== -1) {
      deliveryRoutes.value[index] = data.value
    }
    return data.value
  }
  return null
}

async function deleteDeliveryRoute(id: number) {
  const { error } = useFetch(`${baseURL}/commerce/delivery-routes/${id}`, {
    method: 'DELETE',
  })

  if (error.value) {
    console.error('Error deleting delivery route:', error.value)
    return false
  }

  const index = deliveryRoutes.value.findIndex(s => s.id === id)
  if (index !== -1) {
    deliveryRoutes.value.splice(index, 1)
  }

  return true
}

// Export the composable
export function useDeliveryRoutes() {
  return {
    deliveryRoutes,
    fetchDeliveryRoutes,
    createDeliveryRoute,
    updateDeliveryRoute,
    deleteDeliveryRoute,
  }
}
