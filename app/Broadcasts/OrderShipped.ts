import type { BroadcastConfig } from '@stacksjs/types'
import { log } from '@stacksjs/logging'
import { broadcast } from '@stacksjs/realtime'

interface OrderData {
  orderId: string
  customerName: string
  shippingAddress: string
  items: Array<{
    id: string
    name: string
    quantity: number
  }>
  shippedAt?: string
}

export default {
  channel: 'orders',
  event: 'OrderShipped',
  /**
   * Handle the broadcast event.
   * This method is called when the event is triggered.
   * It handles the broadcasting logic and any additional actions.
   */
  async handle(data: OrderData): Promise<void> {
    log.info('Order shipped:', data)
    // Add shipping timestamp
    data.shippedAt = new Date().toISOString()

    // Broadcast the event to the order-specific private channel
    await broadcast('OrderShipped', data)
      .onChannel(`orders.${data.orderId}`)
      .toPrivate()
      .broadcast()
  },
} satisfies BroadcastConfig

// Usage example:
/*
const orderData = {
  orderId: '12345',
  customerName: 'John Doe',
  shippingAddress: '123 Main St, Anytown, USA',
  items: [
    { id: 'prod_1', name: 'Widget', quantity: 2 },
    { id: 'prod_2', name: 'Gadget', quantity: 1 },
  ],
}

// Trigger the broadcast
await broadcast('OrderShipped', orderData)
  .onChannel(`orders.${orderData.orderId}`)
  .toPrivate()
  .broadcast()
*/
