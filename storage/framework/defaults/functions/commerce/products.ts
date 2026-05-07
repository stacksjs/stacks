import type { NewProduct, Products } from '../../types/defaults'
import { useStorage } from '@stacksjs/browser'
import { pushToast } from '../toasts'

// Create a persistent products array using VueUse's useStorage
const products = useStorage<Products[]>('products', [])

const baseURL = process.env.VITE_API_URL || `http://localhost:${process.env.PORT_API || '3008'}`

async function fetchProducts(): Promise<Products[]> {
  try {
    const response = await fetch(`${baseURL}/commerce/products`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const { data } = await response.json() as { data: Products[] }

    if (Array.isArray(data)) {
      products.value = data
      return data
    }
    else {
      pushToast('error', 'Couldn\'t load products', { detail: `Expected array but received ${typeof data}` })
      return []
    }
  }
  catch (error) {
    pushToast('error', 'Couldn\'t load products', { detail: String(error) })
    return products.value
  }
}

async function createProduct(product: NewProduct): Promise<Products | null> {
  try {
    const response = await fetch(`${baseURL}/commerce/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const { data } = await response.json() as { data: Products }
    if (data) {
      products.value = [...products.value, data]
      pushToast('success', 'Product created')
      return data
    }
    return null
  }
  catch (error) {
    pushToast('error', 'Failed to create product', { detail: String(error) })
    return null
  }
}

async function updateProduct(product: Products): Promise<Products | null> {
  try {
    const response = await fetch(`${baseURL}/commerce/products/${product.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const { data } = await response.json() as { data: Products }
    if (data) {
      const index = products.value.findIndex(p => p.id === product.id)
      if (index !== -1) {
        products.value = [
          ...products.value.slice(0, index),
          data,
          ...products.value.slice(index + 1),
        ]
      }
      pushToast('success', 'Product updated')
      return data
    }
    return null
  }
  catch (error) {
    pushToast('error', 'Failed to update product', { detail: String(error) })
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

    products.value = products.value.filter(p => p.id !== id)
    pushToast('success', 'Product deleted')
    return true
  }
  catch (error) {
    pushToast('error', 'Failed to delete product', { detail: String(error) })
    return false
  }
}

export function useProducts() {
  return {
    products,
    fetchProducts,
    createProduct,
    updateProduct,
    deleteProduct,
  }
}
