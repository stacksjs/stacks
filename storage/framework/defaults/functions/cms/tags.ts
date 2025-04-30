import type { Tags } from '../types'
import { useFetch, useStorage } from '@vueuse/core'

// Create a persistent tags array using VueUse's useStorage
const tags = useStorage<Tags[]>('tags', [])

const baseURL = 'http://localhost:3008/api'

// Basic fetch function to get all tags
async function fetchTags() {
  const { error, data } = useFetch<Tags[]>(`${baseURL}/cms/tags`)

  if (error.value) {
    console.error('Error fetching tags:', error.value)
    return []
  }

  // Ensure data is an array before assigning
  if (Array.isArray(data.value)) {
    tags.value = data.value
    return data.value
  }
  else {
    console.error('Expected array of tags but received:', typeof data.value)
    return []
  }
}

async function createTag(tag: Tags) {
  const { error, data } = useFetch<Tags>(`${baseURL}/cms/tags`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...tag,
      name: tag.name,
      slug: tag.slug,
      description: tag.description,
      is_active: tag.is_active,
      taggable_id: tag.taggable_id,
      taggable_type: tag.taggable_type,
    }),
  })

  if (error.value) {
    console.error('Error creating tag:', error.value)
    return null
  }

  if (data.value) {
    tags.value.push(data.value)
    return data.value
  }
  return null
}

async function updateTag(id: number, tag: Tags) {
  const { error, data } = useFetch<Tags>(`${baseURL}/cms/tags/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...tag,
      name: tag.name,
      slug: tag.slug,
      description: tag.description,
      is_active: tag.is_active,
    }),
  })

  if (error.value) {
    console.error('Error updating tag:', error.value)
    return null
  }

  if (data.value) {
    const index = tags.value.findIndex(t => t.id === id)
    if (index !== -1) {
      tags.value[index] = data.value
    }
    return data.value
  }
  return null
}

async function deleteTag(id: number) {
  const { error } = useFetch(`${baseURL}/cms/tags/${id}`, {
    method: 'DELETE',
  })

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
