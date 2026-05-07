import type { DigitalDeliveries } from '../../../types/defaults'
import { useStorage } from '@stacksjs/browser'
import { pushToast } from '../../toasts'

// Create a persistent digital deliveries array using VueUse's useStorage
const digitalDeliveries = useStorage<DigitalDeliveries[]>('digitalDeliveries', [])

const baseURL = process.env.VITE_API_URL || `http://localhost:${process.env.PORT_API || '3008'}`

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
    pushToast('error', 'Error fetching digital deliveries', { detail: String(error) })
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
    pushToast('error', 'Error creating digital delivery', { detail: String(error) })
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
    pushToast('error', 'Error updating digital delivery', { detail: String(error) })
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
    pushToast('error', 'Error deleting digital delivery', { detail: String(error) })
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
