import type { BroadcastConfig } from '@stacksjs/types'
import { log } from '@stacksjs/logging'

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
}

export default {
  /**
   * The channel the event should be broadcast on.
   */
  channel: 'orders',

  /**
   * The event name.
   */
  event: 'OrderShipped',

  /**
   * Handle the broadcast event.
   * This method is called before the event is broadcast.
   * You can use this to modify the data or perform additional actions.
   */
  async handle(data: OrderData): Promise<void> {
    // You could perform additional actions here before broadcasting
    // For example:
    // - Log the shipping event
    // - Update order status in database
    // - Send notifications to other services

    // The data will be broadcast after this handler completes
    log.info(`Order ${data.orderId} has been shipped to ${data.userId}`)
  },
} satisfies BroadcastConfig

// Usage example:
/*
import { broadcast } from '@stacksjs/broadcasting'

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

// Broadcast the event
await broadcast('OrderShipped', orderData)
  .onChannel('orders')
  .toPrivate()
  .broadcast()
*/
