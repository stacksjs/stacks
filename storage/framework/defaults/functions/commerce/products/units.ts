import { useFetch, useStorage } from '@vueuse/core'

export interface Units {
  id: number
  product_id: number
  name: string
  abbreviation: string
  type: string
  description?: string
  is_default?: boolean
  uuid?: string
  created_at?: string
  updated_at?: string
}

// Create a persistent units array using VueUse's useStorage
const units = useStorage<Units[]>('units', [])

const baseURL = 'http://localhost:3008/api'

// Basic fetch function to get all units
async function fetchUnits(): Promise<Units[]> {
  const { error, data } = useFetch<Units[]>(`${baseURL}/commerce/products/units`)

  if (error.value) {
    console.error('Error fetching units:', error.value)
    return []
  }

  if (Array.isArray(data.value)) {
    units.value = data.value
    return data.value
  }
  else {
    console.error('Expected array of units but received:', typeof data.value)
    return []
  }
}

async function createUnit(unit: Units): Promise<Units | null> {
  const { error, data } = useFetch<Units>(`${baseURL}/commerce/products/units`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(unit),
  })

  if (error.value) {
    console.error('Error creating unit:', error.value)
    return null
  }

  if (data.value) {
    units.value.push(data.value)
    return data.value
  }
  return null
}

async function updateUnit(unit: Units): Promise<Units | null> {
  const { error, data } = useFetch<Units>(`${baseURL}/commerce/products/units/${unit.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(unit),
  })

  if (error.value) {
    console.error('Error updating unit:', error.value)
    return null
  }

  if (data.value) {
    const index = units.value.findIndex(u => u.id === unit.id)
    if (index !== -1) {
      units.value[index] = data.value
    }
    return data.value
  }
  return null
}

async function deleteUnit(id: number): Promise<boolean> {
  const { error } = useFetch(`${baseURL}/commerce/products/units/${id}`, {
    method: 'DELETE',
  })

  if (error.value) {
    console.error('Error deleting unit:', error.value)
    return false
  }

  const index = units.value.findIndex(u => u.id === id)
  if (index !== -1) {
    units.value.splice(index, 1)
  }
  
  return true
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
