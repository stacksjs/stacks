import type { NewShippingZone, ShippingZones } from '../../../types/defaults'
import { useStorage } from '@stacksjs/browser'
import { pushToast } from '../../toasts'

// Create a persistent shipping zones array using VueUse's useStorage
const shippingZones = useStorage<ShippingZones[]>('shippingZones', [])

const baseURL = process.env.VITE_API_URL || `http://localhost:${process.env.PORT_API || '3008'}`

// Basic fetch function to get all shipping zones
async function fetchShippingZones() {
  try {
    const response = await fetch(`${baseURL}/commerce/shipping-zones`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const { data } = await response.json() as { data: ShippingZones[] }

    shippingZones.value = data

    return data
  }
  catch (error) {
    pushToast('error', 'Error fetching shipping zones', { detail: String(error) })
    return []
  }
}

async function createShippingZone(shippingZone: NewShippingZone) {
  try {
    const response = await fetch(`${baseURL}/commerce/shipping-zones`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(shippingZone),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json() as ShippingZones
    if (data) {
      shippingZones.value.push(data)
      return data
    }
    return null
  }
  catch (error) {
    pushToast('error', 'Error creating shipping zone', { detail: String(error) })
    return null
  }
}

async function updateShippingZone(shippingZone: ShippingZones) {
  try {
    const response = await fetch(`${baseURL}/commerce/shipping-zones/${shippingZone.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(shippingZone),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json() as ShippingZones
    if (data) {
      const index = shippingZones.value.findIndex(s => s.id === shippingZone.id)
      if (index !== -1) {
        shippingZones.value[index] = data
      }
      return data
    }
    return null
  }
  catch (error) {
    pushToast('error', 'Error updating shipping zone', { detail: String(error) })
    return null
  }
}

async function deleteShippingZone(id: number) {
  try {
    const response = await fetch(`${baseURL}/commerce/shipping-zones/${id}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const index = shippingZones.value.findIndex(s => s.id === id)
    if (index !== -1) {
      shippingZones.value.splice(index, 1)
    }

    return true
  }
  catch (error) {
    pushToast('error', 'Error deleting shipping zone', { detail: String(error) })
    return false
  }
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
