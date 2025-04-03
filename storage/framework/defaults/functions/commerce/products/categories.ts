import { useStorage, useFetch } from '@vueuse/core'


export interface Categories {
  id: number
  name: string
  description?: string
  image_url?: string
  is_active?: boolean
  parent_category_id?: string
  display_order: number
  uuid?: string
  created_at?: string
  updated_at?: string
}

// Create a persistent categories array using VueUse's useStorage
const categories = useStorage<Categories[]>('categories', [])

const baseURL = 'http://localhost:3008/api'

// Basic fetch function to get all categories
async function fetchCategories() {
  const { error, data } = useFetch<Categories[]>(`${baseURL}/commerce/products/categories`)

  if (error.value) {
    console.error('Error fetching categories:', error.value)
    return []
  }

  if (Array.isArray(data.value)) {
    categories.value = data.value
    return data.value
  }
  else {
    console.error('Expected array of categories but received:', typeof data.value)
    return []
  }
}

async function createCategory(category: Categories) {
  const { error, data } = useFetch<Categories>(`${baseURL}/commerce/products/categories`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(category),
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

async function updateCategory(category: Categories) {
  const { error, data } = useFetch<Categories>(`${baseURL}/commerce/products/categories/${category.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(category),
  })

  if (error.value) {
    console.error('Error updating category:', error.value)
    return null
  }

  if (data.value) {
    const index = categories.value.findIndex(c => c.id === category.id)
    if (index !== -1) {
      categories.value[index] = data.value
    }
    return data.value
  }
  return null
}

async function deleteCategory(id: number) {
  const { error } = useFetch(`${baseURL}/commerce/products/categories/${id}`, {
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
