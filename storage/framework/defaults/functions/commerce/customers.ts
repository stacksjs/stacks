import type { Customers } from '../../types/defaults'
import { useStorage } from '@vueuse/core'

// Create a persistent customers array using VueUse's useStorage
const customers = useStorage<Customers[]>('customers', [])

const baseURL = 'http://localhost:3008'

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
      console.error('Expected array of customers but received:', typeof data)
      return []
    }
  }
  catch (error) {
    console.error('Error fetching customers:', error)
    // Return the stored customers if fetch fails
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
      // Update both the storage and the reactive ref
      customers.value = [...customers.value, data]
      return data
    }
    return null
  }
  catch (error) {
    console.error('Error creating customer:', error)
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
      // Update both the storage and the reactive ref
      const index = customers.value.findIndex(c => c.id === customer.id)
      if (index !== -1) {
        customers.value = [
          ...customers.value.slice(0, index),
          data,
          ...customers.value.slice(index + 1),
        ]
      }
      return data
    }
    return null
  }
  catch (error) {
    console.error('Error updating customer:', error)
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

    // Update both the storage and the reactive ref
    customers.value = customers.value.filter(c => c.id !== id)
    return true
  }
  catch (error) {
    console.error('Error deleting customer:', error)
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
