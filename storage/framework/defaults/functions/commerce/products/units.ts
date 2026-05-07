import type { Units } from '../../../types/defaults'
import { useStorage } from '@stacksjs/browser'
import { pushToast } from '../../toasts'

// Create a persistent units array using VueUse's useStorage
const units = useStorage<Units[]>('units', [])

const baseURL = process.env.VITE_API_URL || `http://localhost:${process.env.PORT_API || '3008'}`

// Basic fetch function to get all units
async function fetchUnits(): Promise<Units[]> {
  try {
    const response = await fetch(`${baseURL}/commerce/products/units`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.json() as Units[]

    if (Array.isArray(data)) {
      units.value = data
      return data
    }
    else {
      pushToast('error', 'Couldn\'t load units', { detail: 'Server returned a non-array response' })
      return []
    }
  }
  catch (error) {
    pushToast('error', 'Error fetching units', { detail: String(error) })
    return []
  }
}

async function createUnit(unit: Units): Promise<Units | null> {
  try {
    const response = await fetch(`${baseURL}/commerce/products/units`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(unit),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json() as Units
    if (data) {
      units.value.push(data)
      return data
    }
    return null
  }
  catch (error) {
    pushToast('error', 'Error creating unit', { detail: String(error) })
    return null
  }
}

async function updateUnit(unit: Units): Promise<Units | null> {
  try {
    const response = await fetch(`${baseURL}/commerce/products/units/${unit.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(unit),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json() as Units
    if (data) {
      const index = units.value.findIndex(u => u.id === unit.id)
      if (index !== -1) {
        units.value[index] = data
      }
      return data
    }
    return null
  }
  catch (error) {
    pushToast('error', 'Error updating unit', { detail: String(error) })
    return null
  }
}

async function deleteUnit(id: number): Promise<boolean> {
  try {
    const response = await fetch(`${baseURL}/commerce/products/units/${id}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const index = units.value.findIndex(u => u.id === id)
    if (index !== -1) {
      units.value.splice(index, 1)
    }

    return true
  }
  catch (error) {
    pushToast('error', 'Error deleting unit', { detail: String(error) })
    return false
  }
}

// Export the composable
export function useUnits() {
  return {
    units,
    fetchUnits,
    createUnit,
    updateUnit,
    deleteUnit,
  }
}
