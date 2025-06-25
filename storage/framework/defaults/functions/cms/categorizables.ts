import type { Categorizables } from '../../types/defaults'
import { useFetch, useStorage } from '@vueuse/core'

// Create a persistent categories array using VueUse's useStorage
const categorizables = useStorage<Categorizables[]>('categorizables', [])

const baseURL = 'http://localhost:3008'

// Basic fetch function to get all categories
async function fetchCategorizables(): Promise<Categorizables[]> {
  const { error, data } = await useFetch(`${baseURL}/cms/categorizables`).get().json()

  const categorizableJson = data.value as Categorizables[]
  if (error.value) {
    console.error('Error fetching categorizables:', error.value)
    return []
  }

  // Ensure data is an array before assigning
  if (Array.isArray(categorizableJson)) {
    categorizables.value = categorizableJson
    return categorizableJson
  }
  else {
    console.error('Expected array of categorizables but received:', typeof categorizableJson)
    return []
  }
}

async function createCategorizable(categorizable: Partial<Categorizables>) {
  const { error, data } = await useFetch(`${baseURL}/cms/categorizables`)
    .post(JSON.stringify({
      ...categorizable,
      name: categorizable.name,
      description: categorizable.description,
      is_active: categorizable.is_active,
      categorizable_type: categorizable.categorizable_type,
    }))
    .json()

  if (error.value) {
    console.error('Error creating categorizable:', error.value)
    return null
  }

  const newCategorizable = data.value as Categorizables
  if (newCategorizable) {
    categorizables.value.push(newCategorizable)
    return newCategorizable
  }
  return null
}

async function updateCategorizable(id: number, categorizable: Partial<Categorizables>) {
  const { error, data } = await useFetch(`${baseURL}/cms/categorizables/${id}`)
    .patch(JSON.stringify({
      ...categorizable,
      name: categorizable.name,
      description: categorizable.description,
      is_active: categorizable.is_active,
    }))
    .json()

  if (error.value) {
    console.error('Error updating categorizable:', error.value)
    return null
  }

  const updatedCategorizable = data.value as Categorizables
  if (updatedCategorizable) {
    const index = categorizables.value.findIndex(c => c.id === id)
    if (index !== -1) {
      categorizables.value[index] = updatedCategorizable
    }
    return updatedCategorizable
  }
  return null
}

async function deleteCategorizable(id: number) {
  const { error } = await useFetch(`${baseURL}/cms/categorizables/${id}`)
    .delete()
    .json()

  if (error.value) {
    console.error('Error deleting categorizable:', error.value)
    return false
  }

  const index = categorizables.value.findIndex(c => c.id === id)
  if (index !== -1) {
    categorizables.value.splice(index, 1)
  }

  return true
}

// Export the composable
export function useCategorizables() {
  return {
    categorizables,
    fetchCategorizables,
    createCategorizable,
    updateCategorizable,
    deleteCategorizable,
  }
}
