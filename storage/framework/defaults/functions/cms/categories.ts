import type { Categorizable } from '../types'
import { useFetch, useStorage } from '@vueuse/core'

// Create a persistent categories array using VueUse's useStorage
const categories = useStorage<Categorizable[]>('categories', [])

const baseURL = 'http://localhost:3008/api'

// Basic fetch function to get all cate gories
async function fetchCategories() {
  const { error, data } = useFetch<Categorizable[]>(`${baseURL}/cms/categories`)

  if (error.value) {
    console.error('Error fetching categories:', error.value)
    return []
  }

  // Ensure data is an array before assigning
  if (Array.isArray(data.value)) {
    categories.value = data.value
    return data.value
  }
  else {
    console.error('Expected array of categories but received:', typeof data.value)
    return []
  }
}

async function createCategory(category: Categorizable) {
  const { error, data } = useFetch<Categorizable>(`${baseURL}/cms/categories`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...category,
      name: category.name,
      description: category.description,
      is_active: category.is_active,
      categorizable_id: category.categorizable_id,
      categorizable_type: category.categorizable_type,
    }),
  })

  if (error.value) {
    console.error('Error creating category:', error.value)
    return null
  }

  if (data.value) {
    categories.value.push(data.value)
    return data.value
  }
  return null
}

async function updateCategory(id: number, category: Categorizable) {
  const { error, data } = useFetch<Categorizable>(`${baseURL}/cms/categories/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...category,
      name: category.name,
      description: category.description,
      is_active: category.is_active,
    }),
  })

  if (error.value) {
    console.error('Error updating category:', error.value)
    return null
  }

  if (data.value) {
    const index = categories.value.findIndex(c => c.id === id)
    if (index !== -1) {
      categories.value[index] = data.value
    }
    return data.value
  }
  return null
}

async function deleteCategory(id: number) {
  const { error } = useFetch(`${baseURL}/cms/categories/${id}`, {
    method: 'DELETE',
  })

  if (error.value) {
    console.error('Error deleting category:', error.value)
    return false
  }

  const index = categories.value.findIndex(c => c.id === id)
  if (index !== -1) {
    categories.value.splice(index, 1)
  }

  return true
}

// Export the composable
export function useCategories() {
  return {
    categories,
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
  }
}
