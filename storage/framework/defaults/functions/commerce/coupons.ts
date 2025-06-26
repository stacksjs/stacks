import type { Coupons, NewCoupon } from '../../types/defaults'
import { useStorage } from '@vueuse/core'

// Create a persistent coupons array using VueUse's useStorage
const coupons = useStorage<Coupons[]>('coupons', [])

const baseURL = 'http://localhost:3008'

// Basic fetch function to get all coupons
async function fetchCoupons() {
  try {
    const response = await fetch(`${baseURL}/commerce/coupons`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const { data } = await response.json() as { data: Coupons[] }

    if (Array.isArray(data)) {
      // Update both the storage and the reactive ref
      coupons.value = data

      return data
    }
    else {
      console.error('Expected array of coupons but received:', typeof data)
      return []
    }
  }
  catch (error) {
    console.error('Error fetching coupons:', error)
    // Return the stored coupons if fetch fails
    return coupons.value
  }
}

async function createCoupon(coupon: Omit<Coupons, 'id'>) {
  try {
    const response = await fetch(`${baseURL}/commerce/coupons`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(coupon),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json() as Coupons
    if (data) {
      // Update both the storage and the reactive ref
      coupons.value = [...coupons.value, data]
      return data
    }
    return null
  }
  catch (error) {
    console.error('Error creating coupon:', error)
    return null
  }
}

async function updateCoupon(id: number, coupon: NewCoupon) {
  try {
    const response = await fetch(`${baseURL}/commerce/coupons/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(coupon),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json() as Coupons
    if (data) {
      // Update both the storage and the reactive ref
      const index = coupons.value.findIndex(c => c.id === coupon.id)
      if (index !== -1) {
        coupons.value = [
          ...coupons.value.slice(0, index),
          data,
          ...coupons.value.slice(index + 1),
        ]
      }
      return data
    }
    return null
  }
  catch (error) {
    console.error('Error updating coupon:', error)
    return null
  }
}

async function deleteCoupon(id: number) {
  try {
    const response = await fetch(`${baseURL}/commerce/coupons/${id}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    // Update both the storage and the reactive ref
    coupons.value = coupons.value.filter(c => c.id !== id)
    return true
  }
  catch (error) {
    console.error('Error deleting coupon:', error)
    return false
  }
}

// Export the composable
export function useCoupons() {
  return {
    coupons,
    fetchCoupons,
    createCoupon,
    updateCoupon,
    deleteCoupon,
  }
}
