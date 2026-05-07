import type { Coupons, NewCoupon } from '../../types/defaults'
import { useStorage } from '@stacksjs/browser'
import { pushToast } from '../toasts'

// Create a persistent coupons array using VueUse's useStorage
const coupons = useStorage<Coupons[]>('coupons', [])

const baseURL = process.env.VITE_API_URL || `http://localhost:${process.env.PORT_API || '3008'}`

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
      pushToast('error', 'Couldn\'t load coupons', { detail: `Expected array but received ${typeof data}` })
      return []
    }
  }
  catch (error) {
    pushToast('error', 'Couldn\'t load coupons', { detail: String(error) })
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
      coupons.value = [...coupons.value, data]
      pushToast('success', 'Coupon created')
      return data
    }
    return null
  }
  catch (error) {
    pushToast('error', 'Failed to create coupon', { detail: String(error) })
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
      const index = coupons.value.findIndex(c => c.id === coupon.id)
      if (index !== -1) {
        coupons.value = [
          ...coupons.value.slice(0, index),
          data,
          ...coupons.value.slice(index + 1),
        ]
      }
      pushToast('success', 'Coupon updated')
      return data
    }
    return null
  }
  catch (error) {
    pushToast('error', 'Failed to update coupon', { detail: String(error) })
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

    coupons.value = coupons.value.filter(c => c.id !== id)
    pushToast('success', 'Coupon deleted')
    return true
  }
  catch (error) {
    pushToast('error', 'Failed to delete coupon', { detail: String(error) })
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
