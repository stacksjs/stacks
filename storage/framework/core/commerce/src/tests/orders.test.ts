import { beforeEach, describe, expect, it } from 'bun:test'
import { refreshDatabase } from '@stacksjs/testing'
import { destroy, bulkDestroy, softDelete, bulkSoftDelete } from '../orders/destroy'
import { fetchById, fetchAll } from '../orders/fetch'

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

beforeEach(async () => {
  await refreshDatabase()
})

describe('Order Module', () => {
  // Since the store.ts file doesn't have actual order creation functions,
  // we'll use the ORM's create method for creating test orders
  
  async function createTestOrder(orderData: Record<string, any> = {}) {
    // Default order data
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
      coupon_id: 0 // Adding coupon_id as required field with default value
    }

    // Merge default data with provided data
    const finalData = { ...defaultData, ...orderData }

    // Insert the order directly using database
    const { db } = await import('@stacksjs/database')
    const result = await db
      .insertInto('orders')
      .values(finalData)
      .executeTakeFirst()

    const orderId = Number(result.insertId)

    // Fetch the created order
    return await fetchById(orderId)
  }

  describe('fetchById', () => {
    it('should fetch an order by ID', async () => {
      // Create a test order
      const uniqueAddress = `Test Address ${Date.now()}`
      const order = await createTestOrder({
        delivery_address: uniqueAddress
      })
      
      // Make sure we have a valid order ID before proceeding
      expect(order).toBeDefined()
      const orderId = order?.id !== undefined ? Number(order.id) : undefined
      
      expect(orderId).toBeDefined()
      if (!orderId) {
        throw new Error('Failed to create test order')
      }

      // Now fetch the order
      const fetchedOrder = await fetchById(orderId)

      expect(fetchedOrder).toBeDefined()
      expect(fetchedOrder?.id).toBe(orderId)
      expect(fetchedOrder?.delivery_address).toBe(uniqueAddress)
      expect(fetchedOrder?.status).toBe('PENDING')
    })

    it('should return undefined when trying to fetch a non-existent order', async () => {
      // Use a very large ID that is unlikely to exist
      const nonExistentId = 99999999

      // Attempt to fetch and expect undefined
      const fetchedOrder = await fetchById(nonExistentId)
      expect(fetchedOrder).toBeUndefined()
    })
  })

  describe('fetchAll', () => {
    it('should fetch all orders with their items', async () => {
      // Create multiple test orders
      await createTestOrder({ delivery_address: 'Address 1' })
      await createTestOrder({ delivery_address: 'Address 2' })
      await createTestOrder({ delivery_address: 'Address 3' })

      // Fetch all orders
      const orders = await fetchAll()
      
      // Check that we have at least the 3 orders we created
      expect(orders.length).toBeGreaterThanOrEqual(3)
      
      // Check that orders have expected properties
      orders.forEach(order => {
        expect(order).toHaveProperty('id')
        expect(order).toHaveProperty('status')
        expect(order).toHaveProperty('total_amount')
        expect(order).toHaveProperty('items')
        expect(Array.isArray(order.items)).toBe(true)
      })
    })
  })

  describe('destroy', () => {
    it('should delete an order from the database', async () => {
      // Create a test order
      const order = await createTestOrder()
      const orderId = order?.id !== undefined ? Number(order.id) : undefined
      
      // Make sure we have a valid order ID before proceeding
      expect(orderId).toBeDefined()
      if (!orderId) {
        throw new Error('Failed to create test order')
      }

      // Verify the order exists
      let fetchedOrder = await fetchById(orderId)
      expect(fetchedOrder).toBeDefined()

      // Delete the order
      const result = await destroy(orderId)
      expect(result).toBe(true)

      // Verify the order no longer exists
      fetchedOrder = await fetchById(orderId)
      expect(fetchedOrder).toBeUndefined()
    })

    it('should return false when trying to delete a non-existent order', async () => {
      // Use a very large ID that is unlikely to exist
      const nonExistentId = 99999999

      // Attempt to delete
      const result = await destroy(nonExistentId)
      expect(result).toBe(false)
    })
  })

  describe('softDelete', () => {
    it('should soft delete an order by updating status to CANCELED', async () => {
      // Create a test order
      const order = await createTestOrder({ status: 'PENDING' })
      const orderId = order?.id !== undefined ? Number(order.id) : undefined
      
      // Make sure we have a valid order ID before proceeding
      expect(orderId).toBeDefined()
      if (!orderId) {
        throw new Error('Failed to create test order')
      }

      // Verify the order exists and status is PENDING
      let fetchedOrder = await fetchById(orderId)
      expect(fetchedOrder).toBeDefined()
      expect(fetchedOrder?.status).toBe('PENDING')

      // Soft delete the order
      const result = await softDelete(orderId)
      expect(result).toBe(true)

      // Verify the order still exists but status is now CANCELED
      fetchedOrder = await fetchById(orderId)
      expect(fetchedOrder).toBeDefined()
      expect(fetchedOrder?.status).toBe('CANCELED')
    })

    it('should return false when trying to soft delete a non-existent order', async () => {
      // Use a very large ID that is unlikely to exist
      const nonExistentId = 99999999

      // Attempt to soft delete
      const result = await softDelete(nonExistentId)
      expect(result).toBe(false)
    })
  })

  describe('bulkDestroy', () => {
    it('should delete multiple orders from the database', async () => {
      // Create multiple test orders
      const order1 = await createTestOrder()
      const order2 = await createTestOrder()
      const order3 = await createTestOrder()
      
      const orderIds = [
        order1?.id !== undefined ? Number(order1.id) : 0,
        order2?.id !== undefined ? Number(order2.id) : 0,
        order3?.id !== undefined ? Number(order3.id) : 0,
      ].filter(id => id !== 0)
      
      // Ensure we have created the orders
      expect(orderIds.length).toBe(3)

      // Delete the orders
      const deletedCount = await bulkDestroy(orderIds)
      expect(deletedCount).toBe(3)

      // Verify the orders no longer exist
      for (const id of orderIds) {
        const fetchedOrder = await fetchById(id)
        expect(fetchedOrder).toBeUndefined()
      }
    })

    it('should return 0 when trying to delete an empty array of orders', async () => {
      // Try to delete with an empty array
      const deletedCount = await bulkDestroy([])
      expect(deletedCount).toBe(0)
    })
  })

  describe('bulkSoftDelete', () => {
    it('should soft delete multiple orders by updating status to CANCELED', async () => {
      // Create multiple test orders
      const order1 = await createTestOrder({ status: 'PENDING' })
      const order2 = await createTestOrder({ status: 'PROCESSING' })
      const order3 = await createTestOrder({ status: 'SHIPPED' })
      
      const orderIds = [
        order1?.id !== undefined ? Number(order1.id) : 0,
        order2?.id !== undefined ? Number(order2.id) : 0,
        order3?.id !== undefined ? Number(order3.id) : 0,
      ].filter(id => id !== 0)
      
      // Ensure we have created the orders
      expect(orderIds.length).toBe(3)

      // Soft delete the orders
      const updatedCount = await bulkSoftDelete(orderIds)
      expect(updatedCount).toBe(3)

      // Verify the orders still exist but status is now CANCELED
      for (const id of orderIds) {
        const fetchedOrder = await fetchById(id)
        expect(fetchedOrder).toBeDefined()
        expect(fetchedOrder?.status).toBe('CANCELED')
      }
    })

    it('should return 0 when trying to soft delete an empty array of orders', async () => {
      // Try to soft delete with an empty array
      const updatedCount = await bulkSoftDelete([])
      expect(updatedCount).toBe(0)
    })
  })
})
