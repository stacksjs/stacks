import type { Categories } from '../../../types/defaults'
import { useStorage } from '@vueuse/core'

// Create a persistent categories array using VueUse's useStorage
const categories = useStorage<Categories[]>('categories', [])

const baseURL = 'http://localhost:3008'

// Basic fetch function to get all categories
async function fetchCategories(): Promise<Categories[]> {
  try {
    const response = await fetch(`${baseURL}/commerce/product-categories`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const { data } = await response.json() as { data: Categories[] }

    if (Array.isArray(data)) {
      categories.value = data
      return data
    }
    else {
      console.error('Expected array of categories but received:', typeof data)
      return []
    }
  }
  catch (error) {
    console.error('Error fetching categories:', error)
    return []
  }
}

async function createCategory(category: Categories): Promise<Categories | null> {
  try {
    const response = await fetch(`${baseURL}/commerce/product-categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(category),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const { data } = await response.json() as { data: Categories }
    if (data) {
      categories.value.push(data)
      return data
    }
    return null
  }
  catch (error) {
    console.error('Error creating category:', error)
    return null
  }
}

async function updateCategory(category: Categories): Promise<Categories | null> {
  try {
    const response = await fetch(`${baseURL}/commerce/product-categories/${category.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(category),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const { data } = await response.json() as { data: Categories }
    if (data) {
      const index = categories.value.findIndex(c => c.id === category.id)
      if (index !== -1) {
        categories.value[index] = data
      }
      return data
    }
    return null
  }
  catch (error) {
    console.error('Error updating category:', error)
    return null
  }
}

async function deleteCategory(id: number): Promise<boolean> {
  try {
    const response = await fetch(`${baseURL}/commerce/product-categories/${id}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const index = categories.value.findIndex(c => c.id === id)
    if (index !== -1) {
      categories.value.splice(index, 1)
    }

    return true
  }
  catch (error) {
    console.error('Error deleting category:', error)
    return false
  }
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
