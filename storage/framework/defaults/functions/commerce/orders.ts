import type { Orders } from '../../types/defaults'
import { useStorage } from '@stacksjs/browser'
import { pushToast } from '../toasts'

// Create a persistent orders array using VueUse's useStorage
const orders = useStorage<Orders[]>('orders', [])

const baseURL = process.env.VITE_API_URL || `http://localhost:${process.env.PORT_API || '3008'}`

async function fetchOrders(): Promise<Orders[]> {
  try {
    const response = await fetch(`${baseURL}/commerce/orders`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const { data } = await response.json() as { data: Orders[] }
    orders.value = data
    return data
  }
  catch (error) {
    pushToast('error', 'Couldn\'t load orders', { detail: String(error) })
    return orders.value
  }
}

async function createOrder(order: Orders) {
  try {
    const response = await fetch(`${baseURL}/commerce/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json() as Orders
    if (data) {
      orders.value.push(data)
      pushToast('success', 'Order created')
      return data
    }
    return null
  }
  catch (error) {
    pushToast('error', 'Failed to create order', { detail: String(error) })
    return null
  }
}

async function updateOrder(order: Orders) {
  try {
    const response = await fetch(`${baseURL}/commerce/orders/${order.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json() as Orders
    if (data) {
      const index = orders.value.findIndex(o => o.id === order.id)
      if (index !== -1) {
        orders.value[index] = data
      }
      pushToast('success', 'Order updated')
      return data
    }
    return null
  }
  catch (error) {
    pushToast('error', 'Failed to update order', { detail: String(error) })
    return null
  }
}

async function deleteOrder(id: number) {
  try {
    const response = await fetch(`${baseURL}/commerce/orders/${id}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const index = orders.value.findIndex(o => o.id === id)
    if (index !== -1) {
      orders.value.splice(index, 1)
    }
    pushToast('success', 'Order deleted')
    return true
  }
  catch (error) {
    pushToast('error', 'Failed to delete order', { detail: String(error) })
    return false
  }
}

export function useOrders() {
  return {
    orders,
    fetchOrders,
    createOrder,
    updateOrder,
    deleteOrder,
  }
}
