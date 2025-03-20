import { beforeEach, describe, expect, it } from 'bun:test'
import { db } from '@stacksjs/database'
import { refreshDatabase } from '@stacksjs/testing'
import { bulkDestroy, bulkSoftDelete, destroy, softDelete } from '../orders/destroy'
import { compareOrdersByPeriod, fetchAll, fetchById, fetchStats } from '../orders/fetch'

// Helper function to create test orders
async function createTestOrder(orderData = {}) {
  const defaultData = {
    status: 'PENDING',
    total_amount: 100.50,
    tax_amount: 8.50,
    discount_amount: 0,
    delivery_fee: 5.00,
    tip_amount: 10.00,
    order_type: 'DELIVERY',
    delivery_address: '123 Test Street',
    special_instructions: 'Please knock',
    estimated_delivery_time: '2023-03-16T18:30:00.000Z',
    customer_id: 1,
    coupon_id: 0,
  }

  const finalData = { ...defaultData, ...orderData }
  const result = await db.insertInto('orders').values(finalData).executeTakeFirst()
  const orderId = Number(result?.insertId) || Number(result?.numInsertedOrUpdatedRows)
  return await fetchById(orderId)
}

beforeEach(async () => {
  await refreshDatabase()
})

describe('Order Module', () => {
  // Basic fetch tests
  it('should fetch an order by ID', async () => {
    const uniqueAddress = `Test Address ${Date.now()}`
    const order = await createTestOrder({ delivery_address: uniqueAddress })

    const orderId = Number(order?.id)
    const fetchedOrder = await fetchById(orderId)

    expect(fetchedOrder).toBeDefined()
    expect(fetchedOrder?.id).toBe(orderId)
    expect(fetchedOrder?.delivery_address).toBe(uniqueAddress)
    expect(fetchedOrder?.status).toBe('PENDING')
  })

  it('should return undefined when fetching non-existent order', async () => {
    const fetchedOrder = await fetchById(99999999)
    expect(fetchedOrder).toBeUndefined()
  })

  it('should fetch all orders with their items', async () => {
    await createTestOrder({ delivery_address: 'Address 1' })
    await createTestOrder({ delivery_address: 'Address 2' })
    await createTestOrder({ delivery_address: 'Address 3' })

    const orders = await fetchAll()

    expect(orders.length).toBeGreaterThanOrEqual(3)

    orders.forEach((order) => {
      expect(order).toHaveProperty('id')
      expect(order).toHaveProperty('status')
      expect(order).toHaveProperty('total_amount')
      expect(order).toHaveProperty('items')
      expect(Array.isArray(order.items)).toBe(true)
    })
  })

  // Status-specific tests
  it('should create orders with different statuses', async () => {
    const pendingOrder = await createTestOrder({ status: 'PENDING' })
    const processingOrder = await createTestOrder({ status: 'PROCESSING' })
    const shippedOrder = await createTestOrder({ status: 'SHIPPED' })
    const deliveredOrder = await createTestOrder({ status: 'DELIVERED' })
    const canceledOrder = await createTestOrder({ status: 'CANCELED' })

    expect(pendingOrder?.status).toBe('PENDING')
    expect(processingOrder?.status).toBe('PROCESSING')
    expect(shippedOrder?.status).toBe('SHIPPED')
    expect(deliveredOrder?.status).toBe('DELIVERED')
    expect(canceledOrder?.status).toBe('CANCELED')
  })

  it('should create orders with different order types', async () => {
    const deliveryOrder = await createTestOrder({ order_type: 'DELIVERY' })
    const pickupOrder = await createTestOrder({ order_type: 'PICKUP' })
    const dineInOrder = await createTestOrder({ order_type: 'DINE_IN' })

    expect(deliveryOrder?.order_type).toBe('DELIVERY')
    expect(pickupOrder?.order_type).toBe('PICKUP')
    expect(dineInOrder?.order_type).toBe('DINE_IN')
  })

  // Stats tests
  it('should fetch order statistics', async () => {
    // Create orders with different statuses and types
    await createTestOrder({ status: 'PENDING', order_type: 'DELIVERY' })
    await createTestOrder({ status: 'PROCESSING', order_type: 'PICKUP' })
    await createTestOrder({ status: 'DELIVERED', order_type: 'DELIVERY' })
    await createTestOrder({ status: 'CANCELED', order_type: 'DINE_IN' })
    await createTestOrder({ status: 'DELIVERED', order_type: 'DELIVERY' })

    const stats = await fetchStats()

    expect(stats.total).toBeGreaterThanOrEqual(5)
    expect(stats.revenue).toBeGreaterThan(0)
    expect(stats.by_status.length).toBeGreaterThan(0)
    expect(stats.by_type.length).toBeGreaterThan(0)
    expect(stats.recent.length).toBeGreaterThanOrEqual(5)
  })

  it('should compare orders between periods', async () => {
    // Create several orders
    for (let i = 0; i < 3; i++) {
      await createTestOrder()
    }

    const comparison = await compareOrdersByPeriod(30)

    expect(comparison).toBeDefined()
    expect(comparison.current_period).toBeGreaterThanOrEqual(3)
    expect(comparison.days_range).toBe(30)
  })

  it('should handle orders with decimal values', async () => {
    const order = await createTestOrder({
      total_amount: 99.99,
      tax_amount: 8.33,
      discount_amount: 5.55,
    })

    expect(order?.total_amount).toBe(99.99)
    expect(order?.tax_amount).toBe(8.33)
    expect(order?.discount_amount).toBe(5.55)
  })

  // Basic delete operations tests
  it('should delete an order from the database', async () => {
    const order = await createTestOrder()
    const orderId = Number(order?.id)

    let fetchedOrder = await fetchById(orderId)
    expect(fetchedOrder).toBeDefined()

    const result = await destroy(orderId)
    expect(result).toBe(true)

    fetchedOrder = await fetchById(orderId)
    expect(fetchedOrder).toBeUndefined()
  })

  it('should soft delete an order by updating status to CANCELED', async () => {
    const order = await createTestOrder({ status: 'PENDING' })
    const orderId = Number(order?.id)

    let fetchedOrder = await fetchById(orderId)
    expect(fetchedOrder).toBeDefined()
    expect(fetchedOrder?.status).toBe('PENDING')

    const result = await softDelete(orderId)
    expect(result).toBe(true)

    fetchedOrder = await fetchById(orderId)
    expect(fetchedOrder).toBeDefined()
    expect(fetchedOrder?.status).toBe('CANCELED')
  })

  it('should delete multiple orders from the database', async () => {
    const order1 = await createTestOrder()
    const order2 = await createTestOrder()
    const order3 = await createTestOrder()

    const orderIds = [
      Number(order1?.id),
      Number(order2?.id),
      Number(order3?.id),
    ]

    const deletedCount = await bulkDestroy(orderIds)
    expect(deletedCount).toBe(3)

    for (const id of orderIds) {
      const fetchedOrder = await fetchById(id)
      expect(fetchedOrder).toBeUndefined()
    }
  })

  it('should return 0 when bulk-deleting empty array', async () => {
    const deletedCount = await bulkDestroy([])
    expect(deletedCount).toBe(0)
  })

  it('should soft delete multiple orders by updating status to CANCELED', async () => {
    const order1 = await createTestOrder({ status: 'PENDING' })
    const order2 = await createTestOrder({ status: 'PROCESSING' })
    const order3 = await createTestOrder({ status: 'SHIPPED' })

    const orderIds = [
      Number(order1?.id),
      Number(order2?.id),
      Number(order3?.id),
    ]

    const updatedCount = await bulkSoftDelete(orderIds)
    expect(updatedCount).toBe(3)

    for (const id of orderIds) {
      const fetchedOrder = await fetchById(id)
      expect(fetchedOrder).toBeDefined()
      expect(fetchedOrder?.status).toBe('CANCELED')
    }
  })

  it('should return 0 when bulk-soft-deleting empty array', async () => {
    const updatedCount = await bulkSoftDelete([])
    expect(updatedCount).toBe(0)
  })

  // Advanced scenarios
  it('should handle soft deleting an already canceled order', async () => {
    const order = await createTestOrder({ status: 'CANCELED' })
    const orderId = Number(order?.id)

    const result = await softDelete(orderId)
    expect(result).toBe(true) // Should still return true as the operation succeeded

    // Status should still be CANCELED
    const fetchedOrder = await fetchById(orderId)
    expect(fetchedOrder?.status).toBe('CANCELED')
  })
})
