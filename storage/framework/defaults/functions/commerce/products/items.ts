import type { ProductItems } from '../../types'
import { useStorage } from '@vueuse/core'

// Create a persistent items array using VueUse's useStorage
const items = useStorage<ProductItems[]>('items', [])

const baseURL = 'http://localhost:3008/api'

// Basic fetch function to get all items
async function fetchItems(): Promise<ProductItems[]> {
  try {
    const response = await fetch(`${baseURL}/commerce/products/items`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.json() as ProductItems[]
    
    if (Array.isArray(data)) {
      items.value = data
      return data
    }
    else {
      console.error('Expected array of items but received:', typeof data)
      return []
    }
  } catch (error) {
    console.error('Error fetching items:', error)
    return []
  }
}

async function createItem(item: ProductItems): Promise<ProductItems | null> {
  try {
    const response = await fetch(`${baseURL}/commerce/products/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(item),
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const data = await response.json() as ProductItems
    if (data) {
      items.value.push(data)
      return data
    }
    return null
  } catch (error) {
    console.error('Error creating item:', error)
    return null
  }
}

async function updateItem(item: ProductItems): Promise<ProductItems | null> {
  try {
    const response = await fetch(`${baseURL}/commerce/products/items/${item.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(item),
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const data = await response.json() as ProductItems
    if (data) {
      const index = items.value.findIndex(i => i.id === item.id)
      if (index !== -1) {
        items.value[index] = data
      }
      return data
    }
    return null
  } catch (error) {
    console.error('Error updating item:', error)
    return null
  }
}

async function deleteItem(id: number): Promise<boolean> {
  try {
    const response = await fetch(`${baseURL}/commerce/products/items/${id}`, {
      method: 'DELETE',
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const index = items.value.findIndex(i => i.id === id)
    if (index !== -1) {
      items.value.splice(index, 1)
    }

    return true
  } catch (error) {
    console.error('Error deleting item:', error)
    return false
  }
}

// Export the composable
export function useItems() {
  return {
    items,
    fetchItems,
    createItem,
    updateItem,
    deleteItem,
  }
}
