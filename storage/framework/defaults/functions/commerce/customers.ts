import type { Customers } from '../../types/defaults'
import { useStorage } from '@stacksjs/browser'
import { pushToast } from '../toasts'

// Create a persistent customers array using VueUse's useStorage
const customers = useStorage<Customers[]>('customers', [])

const baseURL = process.env.VITE_API_URL || `http://localhost:${process.env.PORT_API || '3008'}`

// Basic fetch function to get all customers
async function fetchCustomers() {
  try {
    const response = await fetch(`${baseURL}/commerce/customers`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const { data } = await response.json() as { data: Customers[] }

    if (Array.isArray(data)) {
      // Update both the storage and the reactive ref
      customers.value = data
      return data
    }
    else {
      pushToast('error', 'Couldn\'t load customers', { detail: `Expected array but received ${typeof data}` })
      return []
    }
  }
  catch (error) {
    pushToast('error', 'Couldn\'t load customers', { detail: String(error) })
    // Fall back to whatever we already had cached
    return customers.value
  }
}

async function createCustomer(customer: Omit<Customers, 'id'>) {
  try {
    const response = await fetch(`${baseURL}/commerce/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(customer),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const { data } = await response.json() as { data: Customers }
    if (data) {
      customers.value = [...customers.value, data]
      pushToast('success', 'Customer created')
      return data
    }
    return null
  }
  catch (error) {
    pushToast('error', 'Failed to create customer', { detail: String(error) })
    return null
  }
}

async function updateCustomer(customer: Customers) {
  try {
    const response = await fetch(`${baseURL}/commerce/customers/${customer.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(customer),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const { data } = await response.json() as { data: Customers }
    if (data) {
      const index = customers.value.findIndex(c => c.id === customer.id)
      if (index !== -1) {
        customers.value = [
          ...customers.value.slice(0, index),
          data,
          ...customers.value.slice(index + 1),
        ]
      }
      pushToast('success', 'Customer updated')
      return data
    }
    return null
  }
  catch (error) {
    pushToast('error', 'Failed to update customer', { detail: String(error) })
    return null
  }
}

async function deleteCustomer(id: number) {
  try {
    const response = await fetch(`${baseURL}/commerce/customers/${id}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    customers.value = customers.value.filter(c => c.id !== id)
    pushToast('success', 'Customer deleted')
    return true
  }
  catch (error) {
    pushToast('error', 'Failed to delete customer', { detail: String(error) })
    return false
  }
}

// Export the composable
export function useCustomers() {
  return {
    customers,
    fetchCustomers,
    createCustomer,
    updateCustomer,
    deleteCustomer,
  }
}
