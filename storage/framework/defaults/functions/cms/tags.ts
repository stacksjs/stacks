import type { Tags } from '../types'
import { useFetch, useStorage } from '@vueuse/core'

// Create a persistent tags array using VueUse's useStorage
const tags = useStorage<Tags[]>('tags', [])

const baseURL = 'http://localhost:3008'

// Basic fetch function to get all tags
async function fetchTags() {
  const { error, data } = await useFetch(`${baseURL}/cms/tags`).get().json()

  const tagsJson = data.value as Tags[]
  if (error.value) {
    console.error('Error fetching tags:', error.value)
    return []
  }

  // Ensure data is an array before assigning
  if (Array.isArray(data.value)) {
    tags.value = tagsJson
    return data.value
  }
  else {
    console.error('Expected array of tags but received:', typeof data.value)
    return []
  }
}

async function createTag(tag: Partial<Tags>) {
  const { error, data } = await useFetch(`${baseURL}/cms/tags`)
    .post(JSON.stringify(tag))
    .json()

  if (error.value) {
    console.error('Error creating tag:', error.value)
    return null
  }

  const newTag = data.value as Tags
  if (newTag) {
    tags.value.push(newTag)
    return newTag
  }
  return null
}

async function updateTag(id: number, tag: Partial<Tags>) {
  const { error, data } = await useFetch(`${baseURL}/cms/tags/${id}`)
    .patch(JSON.stringify(tag))
    .json()

  if (error.value) {
    console.error('Error updating tag:', error.value)
    return null
  }

  const updatedTag = data.value as Tags
  if (updatedTag) {
    const index = tags.value.findIndex(t => t.id === id)
    if (index !== -1) {
      tags.value[index] = updatedTag
    }
    return updatedTag
  }
  return null
}

async function deleteTag(id: number) {
  const { error } = await useFetch(`${baseURL}/cms/tags/${id}`)
    .delete()
    .json()

  if (error.value) {
    console.error('Error deleting tag:', error.value)
    return false
  }

  const index = tags.value.findIndex(t => t.id === id)
  if (index !== -1) {
    tags.value.splice(index, 1)
  }

  return true
}

// Export the composable
export function useTags() {
  return {
    tags,
    fetchTags,
    createTag,
    updateTag,
    deleteTag,
  }
}
