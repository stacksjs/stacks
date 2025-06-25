import type { DeliveryRoutes, NewDeliveryRoute } from '../../../types/defaults'
import { useStorage } from '@vueuse/core'

// Create a persistent delivery routes array using VueUse's useStorage
const deliveryRoutes = useStorage<DeliveryRoutes[]>('deliveryRoutes', [])

const baseURL = 'http://localhost:3008'

// Basic fetch function to get all delivery routes
async function fetchDeliveryRoutes() {
  try {
    const response = await fetch(`${baseURL}/commerce/delivery-routes`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const { data } = await response.json() as { data: DeliveryRoutes[] }

    if (Array.isArray(data)) {
      deliveryRoutes.value = data
      return data
    }
    else {
      console.error('Expected array of delivery routes but received:', typeof data)
      return []
    }
  }
  catch (error) {
    console.error('Error fetching delivery routes:', error)
    return []
  }
}

async function createDeliveryRoute(deliveryRoute: NewDeliveryRoute) {
  try {
    const response = await fetch(`${baseURL}/commerce/delivery-routes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(deliveryRoute),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const { data } = await response.json() as { data: DeliveryRoutes }
    if (data) {
      deliveryRoutes.value.push(data)
      return data
    }
    return null
  }
  catch (error) {
    console.error('Error creating delivery route:', error)
    return null
  }
}

async function updateDeliveryRoute(deliveryRoute: DeliveryRoutes) {
  try {
    const response = await fetch(`${baseURL}/commerce/delivery-routes/${deliveryRoute.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(deliveryRoute),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const { data } = await response.json() as { data: DeliveryRoutes }
    if (data) {
      const index = deliveryRoutes.value.findIndex(s => s.id === deliveryRoute.id)
      if (index !== -1) {
        deliveryRoutes.value[index] = data
      }
      return data
    }
    return null
  }
  catch (error) {
    console.error('Error updating delivery route:', error)
    return null
  }
}

async function deleteDeliveryRoute(id: number) {
  try {
    const response = await fetch(`${baseURL}/commerce/delivery-routes/${id}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const index = deliveryRoutes.value.findIndex(s => s.id === id)
    if (index !== -1) {
      deliveryRoutes.value.splice(index, 1)
    }

    return true
  }
  catch (error) {
    console.error('Error deleting delivery route:', error)
    return false
  }
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
