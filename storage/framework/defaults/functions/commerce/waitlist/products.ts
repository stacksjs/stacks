import type { WaitlistProduct } from '../../../types/defaults'
import { useStorage } from '@vueuse/core'

// Create a persistent waitlist products array using VueUse's useStorage
const waitlistProducts = useStorage<WaitlistProduct[]>('waitlist_products', [])

const baseURL = 'http://localhost:3008/api'

// Basic fetch function to get all waitlist products
async function fetchWaitlistProducts() {
  try {
    const response = await fetch(`${baseURL}/commerce/waitlist/products`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.json() as WaitlistProduct[]

    if (Array.isArray(data)) {
      waitlistProducts.value = data
      return data
    }
    else {
      console.error('Expected array of waitlist products but received:', typeof data)
      return []
    }
  }
  catch (error) {
    console.error('Error fetching waitlist products:', error)
    return []
  }
}

async function createWaitlistProduct(waitlistProduct: WaitlistProduct) {
  try {
    const response = await fetch(`${baseURL}/commerce/waitlist/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(waitlistProduct),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json() as WaitlistProduct
    if (data) {
      waitlistProducts.value.push(data)
      return data
    }
    return null
  }
  catch (error) {
    console.error('Error creating waitlist product:', error)
    return null
  }
}

async function updateWaitlistProduct(waitlistProduct: WaitlistProduct) {
  try {
    const response = await fetch(`${baseURL}/commerce/waitlist/products/${waitlistProduct.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(waitlistProduct),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json() as WaitlistProduct
    if (data) {
      const index = waitlistProducts.value.findIndex(wp => wp.id === waitlistProduct.id)
      if (index !== -1) {
        waitlistProducts.value[index] = data
      }
      return data
    }
    return null
  }
  catch (error) {
    console.error('Error updating waitlist product:', error)
    return null
  }
}

async function deleteWaitlistProduct(id: number) {
  try {
    const response = await fetch(`${baseURL}/commerce/waitlist/products/${id}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const index = waitlistProducts.value.findIndex(wp => wp.id === id)
    if (index !== -1) {
      waitlistProducts.value.splice(index, 1)
    }

    return true
  }
  catch (error) {
    console.error('Error deleting waitlist product:', error)
    return false
  }
}

// Export the composable
export function useWaitlistProducts() {
  return {
    waitlistProducts,
    fetchWaitlistProducts,
    createWaitlistProduct,
    updateWaitlistProduct,
    deleteWaitlistProduct,
  }
}
