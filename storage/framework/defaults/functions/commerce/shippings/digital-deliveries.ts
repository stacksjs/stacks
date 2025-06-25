import type { DigitalDeliveries } from '../../../types/defaults'
import { useStorage } from '@vueuse/core'

// Create a persistent digital deliveries array using VueUse's useStorage
const digitalDeliveries = useStorage<DigitalDeliveries[]>('digitalDeliveries', [])

const baseURL = 'http://localhost:3008'

// Basic fetch function to get all digital deliveries
async function fetchDigitalDeliveries() {
  try {
    const response = await fetch(`${baseURL}/commerce/digital-deliveries`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const { data } = await response.json() as { data: DigitalDeliveries[] }

    digitalDeliveries.value = data

    return data
  }
  catch (error) {
    console.error('Error fetching digital deliveries:', error)
    return []
  }
}

async function createDigitalDelivery(digitalDelivery: Omit<DigitalDeliveries, 'id'>) {
  try {
    const response = await fetch(`${baseURL}/commerce/digital-deliveries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(digitalDelivery),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json() as DigitalDeliveries
    if (data) {
      digitalDeliveries.value.push(data)
      return data
    }
    return null
  }
  catch (error) {
    console.error('Error creating digital delivery:', error)
    return null
  }
}

async function updateDigitalDelivery(digitalDelivery: DigitalDeliveries) {
  try {
    const response = await fetch(`${baseURL}/commerce/digital-deliveries/${digitalDelivery.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(digitalDelivery),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json() as DigitalDeliveries
    if (data) {
      const index = digitalDeliveries.value.findIndex(d => d.id === digitalDelivery.id)
      if (index !== -1) {
        digitalDeliveries.value[index] = data
      }
      return data
    }
    return null
  }
  catch (error) {
    console.error('Error updating digital delivery:', error)
    return null
  }
}

async function deleteDigitalDelivery(id: number) {
  try {
    const response = await fetch(`${baseURL}/commerce/digital-deliveries/${id}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const index = digitalDeliveries.value.findIndex(d => d.id === id)
    if (index !== -1) {
      digitalDeliveries.value.splice(index, 1)
    }

    return true
  }
  catch (error) {
    console.error('Error deleting digital delivery:', error)
    return false
  }
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
