import type { Categorizable } from '../types'
import { useFetch, useStorage } from '@vueuse/core'

// Create a persistent categories array using VueUse's useStorage
const categories = useStorage<Categorizable[]>('categories', [])

const baseURL = 'http://localhost:3008'

// Basic fetch function to get all categories
async function fetchCategories() {
  const { error, data } = await useFetch(`${baseURL}/cms/categories`).get().json()

  const categoryJson = data.value as Categorizable[]
  if (error.value) {
    console.error('Error fetching categories:', error.value)
    return []
  }

  // Ensure data is an array before assigning
  if (Array.isArray(data.value)) {
    categories.value = categoryJson
    return data.value
  }
  else {
    console.error('Expected array of categories but received:', typeof data.value)
    return []
  }
}

async function createCategory(category: Partial<Categorizable>) {
  const { error, data } = await useFetch(`${baseURL}/cms/categories`)
    .post(JSON.stringify({
      ...category,
      name: category.name,
      description: category.description,
      is_active: category.is_active,
      categorizable_id: category.categorizable_id,
      categorizable_type: category.categorizable_type,
    }))
    .json()

  if (error.value) {
    console.error('Error creating category:', error.value)
    return null
  }

  const newCategory = data.value as Categorizable
  if (newCategory) {
    categories.value.push(newCategory)
    return newCategory
  }
  return null
}

async function updateCategory(id: number, category: Partial<Categorizable>) {
  const { error, data } = await useFetch(`${baseURL}/cms/categories/${id}`)
    .patch(JSON.stringify({
      ...category,
      name: category.name,
      description: category.description,
      is_active: category.is_active,
    }))
    .json()

  if (error.value) {
    console.error('Error updating category:', error.value)
    return null
  }

  const updatedCategory = data.value as Categorizable
  if (updatedCategory) {
    const index = categories.value.findIndex(c => c.id === id)
    if (index !== -1) {
      categories.value[index] = updatedCategory
    }
    return updatedCategory
  }
  return null
}

async function deleteCategory(id: number) {
  const { error } = await useFetch(`${baseURL}/cms/categories/${id}`)
    .delete()
    .json()

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
