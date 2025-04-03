import { useStorage } from '@vueuse/core'
import { Customers } from '../../types/customer'

// Create a persistent customers array using VueUse's useStorage
const customers = useStorage<Customers[]>('customers', [])

const baseURL = 'http://localhost:3008/api'

// Basic fetch function to get all customers
async function fetchCustomers() {
  try {
    const response = await fetch(`${baseURL}/commerce/customers`)

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`)
    }

    const data = await response.json() as Customers[]

    // Ensure data is an array before assigning
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

// Export the composable
export function useCustomers() {
  return {
    customers,
    fetchCustomers,
  }
}
