import type { Drivers, NewDriver } from '../../../types/defaults'
import { useStorage } from '@vueuse/core'

// Create a persistent drivers array using VueUse's useStorage
const drivers = useStorage<Drivers[]>('drivers', [])

const baseURL = 'http://localhost:3008'

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
      console.error('Expected array of drivers but received:', typeof data)
      return []
    }
  }
  catch (error) {
    console.error('Error fetching drivers:', error)
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
    console.error('Error creating driver:', error)
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
    console.error('Error updating driver:', error)
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
    console.error('Error deleting driver:', error)
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
