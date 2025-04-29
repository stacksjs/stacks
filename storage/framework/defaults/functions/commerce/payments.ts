import type { Payments } from '../types'
import { useFetch, useStorage } from '@vueuse/core'

// Create a persistent payments array using VueUse's useStorage
const payments = useStorage<Payments[]>('payments', [])

const baseURL = 'http://localhost:3008/api'

// Basic fetch function to get all payments
async function fetchPayments(): Promise<Payments[]> {
  const { error, data } = useFetch<Payments[]>(`${baseURL}/commerce/payments`)

  if (error.value) {
    console.error('Error fetching payments:', error.value)
    return []
  }

  if (Array.isArray(data.value)) {
    payments.value = data.value
    return data.value
  }
  else {
    console.error('Expected array of payments but received:', typeof data.value)
    return []
  }
}

async function createPayment(payment: Payments): Promise<Payments | null> {
  const { error, data } = useFetch<Payments>(`${baseURL}/commerce/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payment),
  })

  if (error.value) {
    console.error('Error creating payment:', error.value)
    return null
  }

  if (data.value) {
    payments.value.push(data.value)
    return data.value
  }
  return null
}

async function updatePayment(payment: Payments): Promise<Payments | null> {
  const { error, data } = useFetch<Payments>(`${baseURL}/commerce/payments/${payment.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payment),
  })

  if (error.value) {
    console.error('Error updating payment:', error.value)
    return null
  }

  if (data.value) {
    const index = payments.value.findIndex(p => p.id === payment.id)
    if (index !== -1) {
      payments.value[index] = data.value
    }
    return data.value
  }
  return null
}

async function deletePayment(id: number): Promise<boolean> {
  const { error } = useFetch(`${baseURL}/commerce/payments/${id}`, {
    method: 'DELETE',
  })

  if (error.value) {
    console.error('Error deleting payment:', error.value)
    return false
  }

  const index = payments.value.findIndex(p => p.id === id)
  if (index !== -1) {
    payments.value.splice(index, 1)
  }

  return true
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
