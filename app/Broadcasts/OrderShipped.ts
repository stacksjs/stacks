import type { RealtimeInstance } from '@stacksjs/types'
import { channel } from '@stacksjs/realtime'

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

export default {
  /**
   * The event name.
   */
  event: 'OrderShipped',

  /**
   * Handle the broadcast event.
   * This method is called when the event is triggered.
   */
  async handle(data: OrderData): Promise<void> {
    await channel(`orders.${data.orderId}`).private(this.event, data)
  },
} satisfies RealtimeInstance

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
await broadcast('OrderShipped', orderData)
*/
