import type { Customers } from '../types'
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
    const data = await response.json() as Customers[]

    if (Array.isArray(data)) {
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
    return []
  }
}

async function createCustomer(customer: Customers) {
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

    const data = await response.json() as Customers
    if (data) {
      customers.value.push(data)
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

    const data = await response.json() as Customers
    if (data) {
      const index = customers.value.findIndex(c => c.id === customer.id)
      if (index !== -1) {
        customers.value[index] = data
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

    const index = customers.value.findIndex(c => c.id === id)
    if (index !== -1) {
      customers.value.splice(index, 1)
    }

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
