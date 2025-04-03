import type { Coupons } from '../../types'
import { useFetch, useStorage } from '@vueuse/core'

// Create a persistent coupons array using VueUse's useStorage
const coupons = useStorage<Coupons[]>('coupons', [])

const baseURL = 'http://localhost:3008/api'

// Basic fetch function to get all coupons
async function fetchCoupons() {
  const { error, data } = useFetch<Coupons[]>(`${baseURL}/commerce/coupons`)

  if (error.value) {
    console.error('Error fetching coupons:', error.value)
    return []
  }

  if (Array.isArray(data.value)) {
    coupons.value = data.value
    return data.value
  }
  else {
    console.error('Expected array of coupons but received:', typeof data.value)
    return []
  }
}

async function createCoupon(coupon: Coupons) {
  const { error, data } = useFetch<Coupons>(`${baseURL}/commerce/coupons`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(coupon),
  })

  if (error.value) {
    console.error('Error creating coupon:', error.value)
    return null
  }

  if (data.value) {
    coupons.value.push(data.value)
    return data.value
  }
  return null
}

async function updateCoupon(coupon: Coupons) {
  const { error, data } = useFetch<Coupons>(`${baseURL}/commerce/coupons/${coupon.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(coupon),
  })

  if (error.value) {
    console.error('Error updating coupon:', error.value)
    return null
  }

  if (data.value) {
    const index = coupons.value.findIndex(c => c.id === coupon.id)
    if (index !== -1) {
      coupons.value[index] = data.value
    }
    return data.value
  }
  return null
}

async function deleteCoupon(id: number) {
  const { error } = useFetch(`${baseURL}/commerce/coupons/${id}`, {
    method: 'DELETE',
  })

  if (error.value) {
    console.error('Error deleting coupon:', error.value)
    return false
  }

  const index = coupons.value.findIndex(c => c.id === id)
  if (index !== -1) {
    coupons.value.splice(index, 1)
  }

  return true
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
