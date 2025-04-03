import type { DigitalDeliveries } from '../../../types'
import { useFetch, useStorage } from '@vueuse/core'

// Create a persistent digital deliveries array using VueUse's useStorage
const digitalDeliveries = useStorage<DigitalDeliveries[]>('digitalDeliveries', [])

const baseURL = 'http://localhost:3008/api'

// Basic fetch function to get all digital deliveries
async function fetchDigitalDeliveries() {
  const { error, data } = useFetch<DigitalDeliveries[]>(`${baseURL}/commerce/digital-deliveries`)

  if (error.value) {
    console.error('Error fetching digital deliveries:', error.value)
    return []
  }

  // Ensure data is an array before assigning
  if (Array.isArray(data.value)) {
    digitalDeliveries.value = data.value
    return data.value
  }
  else {
    console.error('Expected array of digital deliveries but received:', typeof data.value)
    return []
  }
}

async function createDigitalDelivery(digitalDelivery: DigitalDeliveries) {
  const { error, data } = useFetch<DigitalDeliveries>(`${baseURL}/commerce/digital-deliveries`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(digitalDelivery),
  })

  if (error.value) {
    console.error('Error creating digital delivery:', error.value)
    return null
  }

  if (data.value) {
    digitalDeliveries.value.push(data.value)
    return data.value
  }
  return null
}

async function updateDigitalDelivery(digitalDelivery: DigitalDeliveries) {
  const { error, data } = useFetch<DigitalDeliveries>(`${baseURL}/commerce/digital-deliveries/${digitalDelivery.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(digitalDelivery),
  })

  if (error.value) {
    console.error('Error updating digital delivery:', error.value)
    return null
  }

  if (data.value) {
    const index = digitalDeliveries.value.findIndex(s => s.id === digitalDelivery.id)
    if (index !== -1) {
      digitalDeliveries.value[index] = data.value
    }
    return data.value
  }
  return null
}

async function deleteDigitalDelivery(id: number) {
  const { error } = useFetch(`${baseURL}/commerce/digital-deliveries/${id}`, {
    method: 'DELETE',
  })

  if (error.value) {
    console.error('Error deleting digital delivery:', error.value)
    return false
  }

  const index = digitalDeliveries.value.findIndex(s => s.id === id)
  if (index !== -1) {
    digitalDeliveries.value.splice(index, 1)
  }

  return true
}

// Export the composable
export function useDigitalDeliveries() {
  return {
    digitalDeliveries,
    fetchDigitalDeliveries,
    createDigitalDelivery,
    updateDigitalDelivery,
    deleteDigitalDelivery,
  }
}
