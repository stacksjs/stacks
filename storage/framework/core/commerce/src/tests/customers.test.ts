import { describe, expect, it, beforeAll, afterAll } from 'bun:test'
import { db } from '@stacksjs/database'
import { fetchById } from '../customers/fetch'
import { store } from '../customers/store'
import type { Generated } from 'kysely'

// Create a request-like object for testing
class TestRequest {
  private data: Record<string, any> = {}

  constructor(data: Record<string, any>) {
    this.data = data
  }

  validate() {
    return Promise.resolve()
  }

  get<T = any>(key: string): T {
    return this.data[key] as T
  }
}

describe('Customer Module', () => {
  let testCustomerId: number | undefined

  // Clean up after all tests
  afterAll(async () => {
    if (testCustomerId) {
      // Delete the test customer from the database
      await db
        .deleteFrom('customers')
        .where('id', '=', testCustomerId)
        .execute()
    }
  })

  describe('store', () => {
    it('should create a new customer in the database', async () => {
      // Create a unique email to avoid conflicts
      const uniqueEmail = `test-${Date.now()}@example.com`
      
      const requestData = {
        name: 'Test Customer',
        email: uniqueEmail,
        phone: '555-123-4567',
        status: 'Active',
        user_id: 1,
      }

      const request = new TestRequest(requestData)
      const customer = await store(request as any)

      expect(customer).toBeDefined()
      expect(customer?.name).toBe('Test Customer')
      expect(customer?.email).toBe(uniqueEmail)
      expect(customer?.phone).toBe('555-123-4567')
      
      // Save the ID for later cleanup and convert from Generated<number> to number
      testCustomerId = customer?.id !== undefined ? Number(customer.id) : undefined
    })
  })

  describe('fetchById', () => {
    it('should fetch a customer by ID', async () => {
      // Skip if we don't have a customer ID from the previous test
      if (!testCustomerId) {
        console.log('Skipping fetchById test because no customer was created')
        return
      }

      const customer = await fetchById(testCustomerId)

      expect(customer).toBeDefined()
      expect(customer?.id).toBe(testCustomerId)
      expect(customer?.name).toBe('Test Customer')
    })
  })
})
