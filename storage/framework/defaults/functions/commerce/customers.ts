import type { Customers } from '../types'
import { useFetch, useStorage } from '@vueuse/core'

// Create a persistent customers array using VueUse's useStorage
const customers = useStorage<Customers[]>('customers', [])

const baseURL = 'http://localhost:3008/api'

// Basic fetch function to get all customers
async function fetchCustomers() {
  const { error, data } = useFetch<Customers[]>(`${baseURL}/commerce/customers`)

  if (error.value) {
    console.error('Error fetching customers:', error.value)
    return []
  }

  // Ensure data is an array before assigning
  if (Array.isArray(data.value)) {
    customers.value = data.value
    return data.value
  }
  else {
    console.error('Expected array of customers but received:', typeof data.value)
    return []
  }
}

async function createCustomer(customer: Customers) {
  const { error, data } = useFetch<Customers>(`${baseURL}/commerce/customers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(customer),
  })

  if (error.value) {
    console.error('Error creating customer:', error.value)
    return null
  }

  if (data.value) {
    customers.value.push(data.value)
    return data.value
  }
  return null
}

async function updateCustomer(customer: Customers) {
  const { error, data } = useFetch<Customers>(`${baseURL}/commerce/customers/${customer.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(customer),
  })

  if (error.value) {
    console.error('Error updating customer:', error.value)
    return null
  }

  if (data.value) {
    const index = customers.value.findIndex(c => c.id === customer.id)
    if (index !== -1) {
      customers.value[index] = data.value
    }
    return data.value
  }
  return null
}

async function deleteCustomer(id: number) {
  const { error } = useFetch(`${baseURL}/commerce/customers/${id}`, {
    method: 'DELETE',
  })

  if (error.value) {
    console.error('Error deleting customer:', error.value)
    return false
  }

  const index = customers.value.findIndex(c => c.id === id)
  if (index !== -1) {
    customers.value.splice(index, 1)
  }

  return true
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
