import type { Payments } from '../../types/defaults'
import { useStorage } from '@vueuse/core'

// Create a persistent payments array using VueUse's useStorage
const payments = useStorage<Payments[]>('payments', [])

const baseURL = 'http://localhost:3008/api'

// Basic fetch function to get all payments
async function fetchPayments(): Promise<Payments[]> {
  try {
    const response = await fetch(`${baseURL}/commerce/payments`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.json() as Payments[]

    if (Array.isArray(data)) {
      payments.value = data
      return data
    }
    else {
      console.error('Expected array of payments but received:', typeof data)
      return []
    }
  }
  catch (error) {
    console.error('Error fetching payments:', error)
    return []
  }
}

async function createPayment(payment: Payments): Promise<Payments | null> {
  try {
    const response = await fetch(`${baseURL}/commerce/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payment),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json() as Payments
    if (data) {
      payments.value.push(data)
      return data
    }
    return null
  }
  catch (error) {
    console.error('Error creating payment:', error)
    return null
  }
}

async function updatePayment(payment: Payments): Promise<Payments | null> {
  try {
    const response = await fetch(`${baseURL}/commerce/payments/${payment.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payment),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json() as Payments
    if (data) {
      const index = payments.value.findIndex(p => p.id === payment.id)
      if (index !== -1) {
        payments.value[index] = data
      }
      return data
    }
    return null
  }
  catch (error) {
    console.error('Error updating payment:', error)
    return null
  }
}

async function deletePayment(id: number): Promise<boolean> {
  try {
    const response = await fetch(`${baseURL}/commerce/payments/${id}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const index = payments.value.findIndex(p => p.id === id)
    if (index !== -1) {
      payments.value.splice(index, 1)
    }

    return true
  }
  catch (error) {
    console.error('Error deleting payment:', error)
    return false
  }
}

// Export the composable
export function usePayments() {
  return {
    payments,
    fetchPayments,
    createPayment,
    updatePayment,
    deletePayment,
  }
}
