import type { Drivers, NewDriver } from '../../../types/defaults'
import { useStorage } from '@stacksjs/browser'
import { pushToast } from '../../toasts'

// Create a persistent drivers array using VueUse's useStorage
const drivers = useStorage<Drivers[]>('drivers', [])

const baseURL = process.env.VITE_API_URL || `http://localhost:${process.env.PORT_API || '3008'}`

// Basic fetch function to get all drivers
async function fetchDrivers() {
  try {
    const response = await fetch(`${baseURL}/commerce/drivers`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const { data } = await response.json() as { data: Drivers[] }

    if (Array.isArray(data)) {
      drivers.value = data
      return data
    }
    else {
      pushToast('error', 'Couldn\'t load drivers', { detail: 'Server returned a non-array response' })
      return []
    }
  }
  catch (error) {
    pushToast('error', 'Error fetching drivers', { detail: String(error) })
    return []
  }
}

async function createDriver(driver: NewDriver) {
  try {
    const response = await fetch(`${baseURL}/commerce/drivers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(driver),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const { data } = await response.json() as { data: Drivers }
    if (data) {
      drivers.value.push(data)
      return data
    }
    return null
  }
  catch (error) {
    pushToast('error', 'Error creating driver', { detail: String(error) })
    return null
  }
}

async function updateDriver(driver: Drivers) {
  try {
    const response = await fetch(`${baseURL}/commerce/drivers/${driver.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(driver),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const { data } = await response.json() as { data: Drivers }
    if (data) {
      const index = drivers.value.findIndex(s => s.id === driver.id)
      if (index !== -1) {
        drivers.value[index] = data
      }
      return data
    }
    return null
  }
  catch (error) {
    pushToast('error', 'Error updating driver', { detail: String(error) })
    return null
  }
}

async function deleteDriver(id: number) {
  try {
    const response = await fetch(`${baseURL}/commerce/drivers/${id}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const index = drivers.value.findIndex(s => s.id === id)
    if (index !== -1) {
      drivers.value.splice(index, 1)
    }

    return true
  }
  catch (error) {
    pushToast('error', 'Error deleting driver', { detail: String(error) })
    return false
  }
}

// Export the composable
export function useDrivers() {
  return {
    drivers,
    fetchDrivers,
    createDriver,
    updateDriver,
    deleteDriver,
  }
}
