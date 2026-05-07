import type { Payments } from '../../types/defaults'
import { useStorage } from '@stacksjs/browser'
import { pushToast } from '../toasts'

// Create a persistent payments array using VueUse's useStorage
const payments = useStorage<Payments[]>('payments', [])

const baseURL = process.env.VITE_API_URL || `http://localhost:${process.env.PORT_API || '3008'}`

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
      pushToast('error', 'Couldn\'t load payments', { detail: `Expected array but received ${typeof data}` })
      return []
    }
  }
  catch (error) {
    pushToast('error', 'Couldn\'t load payments', { detail: String(error) })
    return payments.value
  }
}

async function createPayment(payment: Payments): Promise<Payments | null> {
  try {
    const response = await fetch(`${baseURL}/commerce/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payment),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json() as Payments
    if (data) {
      payments.value.push(data)
      pushToast('success', 'Payment recorded')
      return data
    }
    return null
  }
  catch (error) {
    pushToast('error', 'Failed to record payment', { detail: String(error) })
    return null
  }
}

async function updatePayment(payment: Payments): Promise<Payments | null> {
  try {
    const response = await fetch(`${baseURL}/commerce/payments/${payment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
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
      pushToast('success', 'Payment updated')
      return data
    }
    return null
  }
  catch (error) {
    pushToast('error', 'Failed to update payment', { detail: String(error) })
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
    pushToast('success', 'Payment deleted')
    return true
  }
  catch (error) {
    pushToast('error', 'Failed to delete payment', { detail: String(error) })
    return false
  }
}

export function usePayments() {
  return {
    payments,
    fetchPayments,
    createPayment,
    updatePayment,
    deletePayment,
  }
}
