import type { Orders } from '../../types'
import { useFetch, useStorage } from '@vueuse/core'

// Create a persistent orders array using VueUse's useStorage
const orders = useStorage<Orders[]>('orders', [])

const baseURL = 'http://localhost:3008/api'

// Basic fetch function to get all orders
async function fetchOrders() {
  const { error, data } = useFetch<Orders[]>(`${baseURL}/commerce/orders`)

  if (error.value) {
    console.error('Error fetching orders:', error.value)
    return []
  }

  if (Array.isArray(data.value)) {
    orders.value = data.value
    return data.value
  }
  else {
    console.error('Expected array of orders but received:', typeof data.value)
    return []
  }
}

async function createOrder(order: Orders) {
  const { error, data } = useFetch<Orders>(`${baseURL}/commerce/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(order),
  })

  if (error.value) {
    console.error('Error creating order:', error.value)
    return null
  }

  if (data.value) {
    orders.value.push(data.value)
    return data.value
  }
  return null
}

async function updateOrder(order: Orders) {
  const { error, data } = useFetch<Orders>(`${baseURL}/commerce/orders/${order.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(order),
  })

  if (error.value) {
    console.error('Error updating order:', error.value)
    return null
  }

  if (data.value) {
    const index = orders.value.findIndex(o => o.id === order.id)
    if (index !== -1) {
      orders.value[index] = data.value
    }
    return data.value
  }
  return null
}

async function deleteOrder(id: number) {
  const { error } = useFetch(`${baseURL}/commerce/orders/${id}`, {
    method: 'DELETE',
  })

  if (error.value) {
    console.error('Error deleting order:', error.value)
    return false
  }

  const index = orders.value.findIndex(o => o.id === id)
  if (index !== -1) {
    orders.value.splice(index, 1)
  }

  return true
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
