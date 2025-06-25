import type { Taggables } from '../../types/defaults'
import { useFetch, useStorage } from '@vueuse/core'

// Create a persistent tags array using VueUse's useStorage
const taggables = useStorage<Taggables[]>('taggables', [])

const baseURL = 'http://localhost:3008'

// Basic fetch function to get all tags
async function fetchTaggables(): Promise<Taggables[]> {
  const { error, data } = await useFetch(`${baseURL}/cms/taggables`).get().json()

  const taggablesJson = data.value as Taggables[]
  if (error.value) {
    console.error('Error fetching taggables:', error.value)
    return []
  }

  // Ensure data is an array before assigning
  if (Array.isArray(data.value)) {
    taggables.value = taggablesJson

    return taggablesJson
  }
  else {
    console.error('Expected array of taggables but received:', typeof data.value)
    return []
  }
}

async function createTaggable(taggable: Partial<Taggables>) {
  const taggableData = {
    ...taggable,
    taggable_type: 'posts',
  }

  const { error, data } = await useFetch(`${baseURL}/cms/taggables`)
    .post(JSON.stringify(taggableData))
    .json()

  if (error.value) {
    console.error('Error creating taggable:', error.value)
    return null
  }

  const newTaggable = data.value as Taggables
  if (newTaggable) {
    taggables.value.push(newTaggable)
    return newTaggable
  }
  return null
}

async function updateTaggable(id: number, taggable: Partial<Taggables>) {
  const { error, data } = await useFetch(`${baseURL}/cms/taggables/${id}`)
    .patch(JSON.stringify(taggable))
    .json()

  if (error.value) {
    console.error('Error updating taggable:', error.value)
    return null
  }

  const updatedTaggable = data.value as Taggables
  if (updatedTaggable) {
    const index = taggables.value.findIndex(t => t.id === id)
    if (index !== -1) {
      taggables.value[index] = updatedTaggable
    }
    return updatedTaggable
  }
  return null
}

async function deleteTaggable(id: number) {
  const { error } = await useFetch(`${baseURL}/cms/taggables/${id}`)
    .delete()
    .json()

  if (error.value) {
    console.error('Error deleting taggable:', error.value)
    return false
  }

  const index = taggables.value.findIndex(t => t.id === id)
  if (index !== -1) {
    taggables.value.splice(index, 1)
  }

  return true
}

// Export the composable
export function useTaggables() {
  return {
    taggables,
    fetchTaggables,
    createTaggable,
    updateTaggable,
    deleteTaggable,
  }
}
