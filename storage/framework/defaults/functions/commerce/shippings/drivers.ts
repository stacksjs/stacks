import type { Drivers } from '../../../types'
import { useFetch, useStorage } from '@vueuse/core'

// Create a persistent drivers array using VueUse's useStorage
const drivers = useStorage<Drivers[]>('drivers', [])

const baseURL = 'http://localhost:3008/api'

// Basic fetch function to get all drivers
async function fetchDrivers() {
  const { error, data } = useFetch<Drivers[]>(`${baseURL}/commerce/drivers`)

  if (error.value) {
    console.error('Error fetching drivers:', error.value)
    return []
  }

  // Ensure data is an array before assigning
  if (Array.isArray(data.value)) {
    drivers.value = data.value
    return data.value
  }
  else {
    console.error('Expected array of drivers but received:', typeof data.value)
    return []
  }
}

async function createDriver(driver: Drivers) {
  const { error, data } = useFetch<Drivers>(`${baseURL}/commerce/drivers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(driver),
  })

  if (error.value) {
    console.error('Error creating driver:', error.value)
    return null
  }

  if (data.value) {
    drivers.value.push(data.value)
    return data.value
  }
  return null
}

async function updateDriver(driver: Drivers) {
  const { error, data } = useFetch<Drivers>(`${baseURL}/commerce/drivers/${driver.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(driver),
  })

  if (error.value) {
    console.error('Error updating driver:', error.value)
    return null
  }

  if (data.value) {
    const index = drivers.value.findIndex(s => s.id === driver.id)
    if (index !== -1) {
      drivers.value[index] = data.value
    }
    return data.value
  }
  return null
}

async function deleteDriver(id: number) {
  const { error } = useFetch(`${baseURL}/commerce/drivers/${id}`, {
    method: 'DELETE',
  })

  if (error.value) {
    console.error('Error deleting driver:', error.value)
    return false
  }

  const index = drivers.value.findIndex(s => s.id === id)
  if (index !== -1) {
    drivers.value.splice(index, 1)
  }

  return true
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
