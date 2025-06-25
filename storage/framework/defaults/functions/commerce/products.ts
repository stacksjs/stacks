import type { NewProduct, Products } from '../../types/defaults'
import { useStorage } from '@vueuse/core'

// Create a persistent products array using VueUse's useStorage
const products = useStorage<Products[]>('products', [])

const baseURL = 'http://localhost:3008'

// Basic fetch function to get all products
async function fetchProducts(): Promise<Products[]> {
  try {
    const response = await fetch(`${baseURL}/commerce/products`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const { data } = await response.json() as { data: Products[] }

    if (Array.isArray(data)) {
      // Update both the storage and the reactive ref
      products.value = data
      return data
    }
    else {
      console.error('Expected array of products but received:', typeof data)
      return []
    }
  }
  catch (error) {
    console.error('Error fetching products:', error)
    // Return the stored products if fetch fails
    return products.value
  }
}

async function createProduct(product: NewProduct): Promise<Products | null> {
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

    const { data } = await response.json() as { data: Products }
    if (data) {
      // Update both the storage and the reactive ref
      products.value = [...products.value, data]
      return data
    }
    return null
  }
  catch (error) {
    console.error('Error creating product:', error)
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

    const { data } = await response.json() as { data: Products }
    if (data) {
      // Update both the storage and the reactive ref
      const index = products.value.findIndex(p => p.id === product.id)
      if (index !== -1) {
        products.value = [
          ...products.value.slice(0, index),
          data,
          ...products.value.slice(index + 1),
        ]
      }
      return data
    }
    return null
  }
  catch (error) {
    console.error('Error updating product:', error)
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

    // Update both the storage and the reactive ref
    products.value = products.value.filter(p => p.id !== id)
    return true
  }
  catch (error) {
    console.error('Error deleting product:', error)
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
