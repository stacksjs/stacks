import { fetch } from '@stacksjs/browser'
import { useStorage } from '@vueuse/core'

// Create a persistent customers array using VueUse's useStorage
const customers = useStorage<any[]>('customers', [])

// Basic fetch function to get all customers
async function fetchCustomers() {
  try {
    const response = await fetch('/api/commerce/customers')

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`)
    }

    const data = await response.json()

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
