import type { WaitlistProduct } from '../../../types'
import { useFetch, useStorage } from '@vueuse/core'

// Create a persistent waitlist products array using VueUse's useStorage
const waitlistProducts = useStorage<WaitlistProduct[]>('waitlist_products', [])

const baseURL = 'http://localhost:3008/api'

// Basic fetch function to get all waitlist products
async function fetchWaitlistProducts() {
  const { error, data } = useFetch<WaitlistProduct[]>(`${baseURL}/commerce/waitlist/products`)

  if (error.value) {
    console.error('Error fetching waitlist products:', error.value)
    return []
  }

  // Ensure data is an array before assigning
  if (Array.isArray(data.value)) {
    waitlistProducts.value = data.value
    return data.value
  }
  else {
    console.error('Expected array of waitlist products but received:', typeof data.value)
    return []
  }
}

async function createWaitlistProduct(waitlistProduct: WaitlistProduct) {
  const { error, data } = useFetch<WaitlistProduct>(`${baseURL}/commerce/waitlist/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(waitlistProduct),
  })

  if (error.value) {
    console.error('Error creating waitlist product:', error.value)
    return null
  }

  if (data.value) {
    waitlistProducts.value.push(data.value)
    return data.value
  }
  return null
}

async function updateWaitlistProduct(waitlistProduct: WaitlistProduct) {
  const { error, data } = useFetch<WaitlistProduct>(`${baseURL}/commerce/waitlist/products/${waitlistProduct.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(waitlistProduct),
  })

  if (error.value) {
    console.error('Error updating waitlist product:', error.value)
    return null
  }

  if (data.value) {
    const index = waitlistProducts.value.findIndex(wp => wp.id === waitlistProduct.id)
    if (index !== -1) {
      waitlistProducts.value[index] = data.value
    }
    return data.value
  }
  return null
}

async function deleteWaitlistProduct(id: number) {
  const { error } = useFetch(`${baseURL}/commerce/waitlist/products/${id}`, {
    method: 'DELETE',
  })

  if (error.value) {
    console.error('Error deleting waitlist product:', error.value)
    return false
  }

  const index = waitlistProducts.value.findIndex(wp => wp.id === id)
  if (index !== -1) {
    waitlistProducts.value.splice(index, 1)
  }

  return true
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
