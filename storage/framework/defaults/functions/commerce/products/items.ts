import { useFetch, useStorage } from '@vueuse/core'

// Create a persistent items array using VueUse's useStorage
const items = useStorage<Items[]>('items', [])

const baseURL = 'http://localhost:3008/api'

// Basic fetch function to get all items
async function fetchItems() {
  const { error, data } = useFetch<Items[]>(`${baseURL}/commerce/products/items`)

  if (error.value) {
    console.error('Error fetching items:', error.value)
    return []
  }

  if (Array.isArray(data.value)) {
    items.value = data.value
    return data.value
  }
  else {
    console.error('Expected array of items but received:', typeof data.value)
    return []
  }
}

async function createItem(item: Items) {
  const { error, data } = useFetch<Items>(`${baseURL}/commerce/products/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(item),
  })

  if (error.value) {
    console.error('Error creating item:', error.value)
    return null
  }

  if (data.value) {
    items.value.push(data.value)
    return data.value
  }
  return null
}

async function updateItem(item: Items) {
  const { error, data } = useFetch<Items>(`${baseURL}/commerce/products/items/${item.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(item),
  })

  if (error.value) {
    console.error('Error updating item:', error.value)
    return null
  }

  if (data.value) {
    const index = items.value.findIndex(i => i.id === item.id)
    if (index !== -1) {
      items.value[index] = data.value
    }
    return data.value
  }
  return null
}

async function deleteItem(id: number) {
  const { error } = useFetch(`${baseURL}/commerce/products/items/${id}`, {
    method: 'DELETE',
  })

  if (error.value) {
    console.error('Error deleting item:', error.value)
    return false
  }

  const index = items.value.findIndex(i => i.id === id)
  if (index !== -1) {
    items.value.splice(index, 1)
  }

  return true
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
