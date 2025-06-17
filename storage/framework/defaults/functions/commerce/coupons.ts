import type { Coupons } from '../types'
import { useStorage } from '@vueuse/core'

// Create a persistent coupons array using VueUse's useStorage
const coupons = useStorage<Coupons[]>('coupons', [])

const baseURL = 'http://localhost:3008/api'

// Basic fetch function to get all coupons
async function fetchCoupons() {
  try {
    const response = await fetch(`${baseURL}/commerce/coupons`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.json() as Coupons[]
    
    if (Array.isArray(data)) {
      coupons.value = data
      return data
    }
    else {
      console.error('Expected array of coupons but received:', typeof data)
      return []
    }
  } catch (error) {
    console.error('Error fetching coupons:', error)
    return []
  }
}

async function createCoupon(coupon: Coupons) {
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
      coupons.value.push(data)
      return data
    }
    return null
  } catch (error) {
    console.error('Error creating coupon:', error)
    return null
  }
}

async function updateCoupon(coupon: Coupons) {
  try {
    const response = await fetch(`${baseURL}/commerce/coupons/${coupon.id}`, {
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
      const index = coupons.value.findIndex(c => c.id === coupon.id)
      if (index !== -1) {
        coupons.value[index] = data
      }
      return data
    }
    return null
  } catch (error) {
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

    const index = coupons.value.findIndex(c => c.id === id)
    if (index !== -1) {
      coupons.value.splice(index, 1)
    }

    return true
  } catch (error) {
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
