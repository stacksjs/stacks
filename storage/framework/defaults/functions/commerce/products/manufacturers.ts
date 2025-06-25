import type { Manufacturers } from '../../../types/defaults'
import { useStorage } from '@vueuse/core'

// Create a persistent manufacturers array using VueUse's useStorage
const manufacturers = useStorage<Manufacturers[]>('manufacturers', [])

const baseURL = 'http://localhost:3008'

// Basic fetch function to get all manufacturers
async function fetchManufacturers(): Promise<Manufacturers[]> {
  try {
    const response = await fetch(`${baseURL}/commerce/product-manufacturers`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const { data } = await response.json() as { data: Manufacturers[] }

    if (Array.isArray(data)) {
      manufacturers.value = data
      return data
    }
    else {
      console.error('Expected array of manufacturers but received:', typeof data)
      return []
    }
  }
  catch (error) {
    console.error('Error fetching manufacturers:', error)
    return []
  }
}

async function createManufacturer(manufacturer: Manufacturers): Promise<Manufacturers | null> {
  try {
    const response = await fetch(`${baseURL}/commerce/product-manufacturers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(manufacturer),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const { data } = await response.json() as { data: Manufacturers }
    if (data) {
      manufacturers.value.push(data)
      return data
    }
    return null
  }
  catch (error) {
    console.error('Error creating manufacturer:', error)
    return null
  }
}

async function updateManufacturer(manufacturer: Manufacturers): Promise<Manufacturers | null> {
  try {
    const response = await fetch(`${baseURL}/commerce/product-manufacturers/${manufacturer.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(manufacturer),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const { data } = await response.json() as { data: Manufacturers }
    if (data) {
      const index = manufacturers.value.findIndex(m => m.id === manufacturer.id)
      if (index !== -1) {
        manufacturers.value[index] = data
      }
      return data
    }
    return null
  }
  catch (error) {
    console.error('Error updating manufacturer:', error)
    return null
  }
}

async function deleteManufacturer(id: number): Promise<boolean> {
  try {
    const response = await fetch(`${baseURL}/commerce/product-manufacturers/${id}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const index = manufacturers.value.findIndex(m => m.id === id)
    if (index !== -1) {
      manufacturers.value.splice(index, 1)
    }

    return true
  }
  catch (error) {
    console.error('Error deleting manufacturer:', error)
    return false
  }
}

// Export the composable
export function useManufacturers() {
  return {
    manufacturers,
    fetchManufacturers,
    createManufacturer,
    updateManufacturer,
    deleteManufacturer,
  }
}
