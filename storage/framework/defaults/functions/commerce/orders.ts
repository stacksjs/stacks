import { useStorage } from '@vueuse/core'
import type { Orders } from '../../types/order'

// Create a persistent orders array using VueUse's useStorage
const orders = useStorage<Orders[]>('orders', [])

const baseURL = 'http://localhost:3008/api'

// Basic fetch function to get all orders
async function fetchOrders() {
  try {
    const response = await fetch(`${baseURL}/commerce/orders`)

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`)
    }

    const data = await response.json() as Orders[]

    // Ensure data is an array before assigning
    if (Array.isArray(data)) {
      orders.value = data
      return data
    }
    else {
      console.error('Expected array of orders but received:', typeof data)
      return []
    }
  }
  catch (error) {
    console.error('Error fetching orders:', error)
    return []
  }
}

async function createOrder(order: Orders) {
  try {
    const response = await fetch(`${baseURL}/commerce/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(order),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`)
    }

    const data = await response.json() as Orders
    orders.value.push(data)
    return data
  }
  catch (error) {
    console.error('Error creating order:', error)
    return null
  }
}

async function updateOrder(order: Orders) {
  try {
    const response = await fetch(`${baseURL}/commerce/orders/${order.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(order),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`)
    }

    const data = await response.json() as Orders
    const index = orders.value.findIndex(o => o.id === order.id)
    if (index !== -1) {
      orders.value[index] = data
    }
    return data
  }
  catch (error) {
    console.error('Error updating order:', error)
    return null
  }
}

async function deleteOrder(id: number) {
  try {
    const response = await fetch(`${baseURL}/commerce/orders/${id}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`)
    }

    const index = orders.value.findIndex(o => o.id === id)
    if (index !== -1) {
      orders.value.splice(index, 1)
    }
    
    return true
  }
  catch (error) {
    console.error('Error deleting order:', error)
    return false
  }
}

// Export the composable
export function useOrders() {
  return {
    orders,
    fetchOrders,
    createOrder,
    updateOrder,
    deleteOrder,
  }
}
