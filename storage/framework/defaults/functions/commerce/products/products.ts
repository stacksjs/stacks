import type { Products } from '../../../types/defaults'
import { useStorage } from '@stacksjs/browser'
import { pushToast } from '../../toasts'

// Create a persistent items array using VueUse's useStorage
const products = useStorage<Products[]>('products', [])

const baseURL = process.env.VITE_API_URL || `http://localhost:${process.env.PORT_API || '3008'}`

// Basic fetch function to get all items
async function fetchProducts(): Promise<Products[]> {
  try {
    const response = await fetch(`${baseURL}/commerce/products`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.json() as Products[]

    if (Array.isArray(data)) {
      products.value = data
      return data
    }
    else {
      pushToast('error', 'Couldn\'t load items', { detail: 'Server returned a non-array response' })
      return []
    }
  }
  catch (error) {
    pushToast('error', 'Error fetching items', { detail: String(error) })
    return []
  }
}

async function createProduct(product: Products): Promise<Products | null> {
  try {
    const response = await fetch(`${baseURL}/commerce/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(product),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json() as Products
    if (data) {
      products.value.push(data)
      return data
    }
    return null
  }
  catch (error) {
    pushToast('error', 'Error creating item', { detail: String(error) })
    return null
  }
}

async function updateProduct(product: Products): Promise<Products | null> {
  try {
    const response = await fetch(`${baseURL}/commerce/products/${product.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(product),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json() as Products
    if (data) {
      const index = products.value.findIndex(i => i.id === product.id)
      if (index !== -1) {
        products.value[index] = data
      }
      return data
    }
    return null
  }
  catch (error) {
    pushToast('error', 'Error updating product', { detail: String(error) })
    return null
  }
}

async function deleteProduct(id: number): Promise<boolean> {
  try {
    const response = await fetch(`${baseURL}/commerce/products/${id}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const index = products.value.findIndex(i => i.id === id)
    if (index !== -1) {
      products.value.splice(index, 1)
    }

    return true
  }
  catch (error) {
    pushToast('error', 'Error deleting product', { detail: String(error) })
    return false
  }
}

// Export the composable
export function useProducts() {
  return {
    products,
    fetchProducts,
    createProduct,
    updateProduct,
    deleteProduct,
  }
}
