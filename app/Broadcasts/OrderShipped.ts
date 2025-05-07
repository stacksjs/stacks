import type { BroadcastConfig } from '@stacksjs/types'
import { log } from '@stacksjs/logging'
import { Realtime } from '@stacksjs/realtime'

interface OrderData {
  orderId: string
  userId: string
  products: Array<{
    id: string
    name: string
    quantity: number
  }>
  totalAmount: number
  shippingAddress: {
    street: string
    city: string
    country: string
    postalCode: string
  }
  shippedAt?: string
}

const EVENT_NAME = 'OrderShipped'

export default {
  /**
   * The channel the event should be broadcast on.
   */
  channel: 'orders',

  /**
   * The event name.
   */
  event: EVENT_NAME,

  /**
   * Handle the broadcast event.
   * This method is called when the event is triggered.
   * It handles the broadcasting logic and any additional actions.
   */
  async handle(data: OrderData): Promise<void> {
    // Log the shipping event
    log.info(`Order ${data.orderId} has been shipped to ${data.userId}`)

    // Add shipping timestamp to the data
    data.shippedAt = new Date().toISOString()

    // Initialize realtime and broadcast
    const realtime = new Realtime()
    await realtime.connect()
    realtime.broadcast(
      `orders.${data.orderId}`,
      EVENT_NAME,
      data,
      'private'
    )
  },
} satisfies BroadcastConfig

// Usage example:
/*
const orderData = {
  orderId: '12345',
  userId: 'user_123',
  products: [
    { id: 'prod_1', name: 'Widget', quantity: 2 },
    { id: 'prod_2', name: 'Gadget', quantity: 1 },
  ],
  totalAmount: 99.99,
  shippingAddress: {
    street: '123 Main St',
    city: 'Anytown',
    country: 'USA',
    postalCode: '12345',
  },
}

// Trigger the broadcast
await runBroadcast('OrderShipped', orderData)
*/
