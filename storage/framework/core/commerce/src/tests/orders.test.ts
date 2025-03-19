import { beforeEach, describe, expect, it } from 'bun:test'
import { refreshDatabase } from '@stacksjs/testing'
import { destroy, bulkDestroy, softDelete, bulkSoftDelete } from '../orders/destroy'
import { fetchById, fetchAll } from '../orders/fetch'
import { db } from '@stacksjs/database'

// Create a request-like object for testing
class TestRequest {
  private data: Record<string, any> = {}

  constructor(data: Record<string, any>) {
    this.data = data
  }

  validate() {
    return Promise.resolve()
  }

  get<T = any>(key: string, defaultValue?: T): T {
    return key in this.data ? this.data[key] as T : (defaultValue as T)
  }
}

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
    coupon_id: 0
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
    
    orders.forEach(order => {
      expect(order).toHaveProperty('id')
      expect(order).toHaveProperty('status')
      expect(order).toHaveProperty('total_amount')
      expect(order).toHaveProperty('items')
      expect(Array.isArray(order.items)).toBe(true)
    })
  })

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
      Number(order3?.id)
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
      Number(order3?.id)
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
})
