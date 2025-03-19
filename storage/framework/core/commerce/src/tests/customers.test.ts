import { beforeEach, describe, expect, it } from 'bun:test'
import { refreshDatabase } from '@stacksjs/testing'
import { remove } from '../customers/destroy'
import { fetchById } from '../customers/fetch'
import { store } from '../customers/store'
import { update } from '../customers/update'

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

beforeEach(async () => {
  await refreshDatabase()
})

describe('Customer Module', () => {
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

      // Save the ID and convert from Generated<number> to number
      const customerId = customer?.id !== undefined ? Number(customer.id) : undefined

      // Verify we can fetch the customer we just created
      if (customerId) {
        const fetchedCustomer = await fetchById(customerId)
        expect(fetchedCustomer).toBeDefined()
        expect(fetchedCustomer?.id).toBe(customerId)
      }
    })
  })

  describe('fetchById', () => {
    it('should fetch a customer by ID', async () => {
      // First create a customer to fetch
      const uniqueEmail = `test-fetch-${Date.now()}@example.com`
      const requestData = {
        name: 'Fetch Test Customer',
        email: uniqueEmail,
        phone: '555-987-6543',
        status: 'Active',
        user_id: 1,
      }

      const request = new TestRequest(requestData)
      const customer = await store(request as any)
      const customerId = customer?.id !== undefined ? Number(customer.id) : undefined

      // Make sure we have a valid customer ID before proceeding
      expect(customerId).toBeDefined()
      if (!customerId) {
        throw new Error('Failed to create test customer')
      }

      // Now fetch the customer
      const fetchedCustomer = await fetchById(customerId)

      expect(fetchedCustomer).toBeDefined()
      expect(fetchedCustomer?.id).toBe(customerId)
      expect(fetchedCustomer?.name).toBe('Fetch Test Customer')
      expect(fetchedCustomer?.email).toBe(uniqueEmail)
    })
  })

  describe('update', () => {
    it('should update an existing customer', async () => {
      // First create a customer to update
      const uniqueEmail = `test-update-${Date.now()}@example.com`
      const initialData = {
        name: 'Update Test Customer',
        email: uniqueEmail,
        phone: '555-111-2222',
        status: 'Active',
        user_id: 1,
      }

      // Create the customer
      const createRequest = new TestRequest(initialData)
      const customer = await store(createRequest as any)
      const customerId = customer?.id !== undefined ? Number(customer.id) : undefined

      // Make sure we have a valid customer ID before proceeding
      expect(customerId).toBeDefined()
      if (!customerId) {
        throw new Error('Failed to create test customer')
      }

      // Update the customer with new data
      const updateData = {
        name: 'Updated Customer Name',
        phone: '555-333-4444',
      }

      const updateRequest = new TestRequest(updateData)
      const updatedCustomer = await update(customerId, updateRequest as any)

      // Verify the update was successful
      expect(updatedCustomer).toBeDefined()
      expect(updatedCustomer?.id).toBe(customerId)
      expect(updatedCustomer?.name).toBe('Updated Customer Name')
      expect(updatedCustomer?.phone).toBe('555-333-4444')

      // The email should remain unchanged
      expect(updatedCustomer?.email).toBe(uniqueEmail)
    })
  })

  describe('remove', () => {
    it('should delete a customer from the database', async () => {
      // First create a customer to delete
      const uniqueEmail = `test-delete-${Date.now()}@example.com`
      const requestData = {
        name: 'Delete Test Customer',
        email: uniqueEmail,
        phone: '555-999-8888',
        status: 'Active',
        user_id: 1,
      }

      // Create the customer
      const request = new TestRequest(requestData)
      const customer = await store(request as any)
      const customerId = customer?.id !== undefined ? Number(customer.id) : undefined

      // Make sure we have a valid customer ID before proceeding
      expect(customerId).toBeDefined()
      if (!customerId) {
        throw new Error('Failed to create test customer')
      }

      // Verify the customer exists
      let fetchedCustomer = await fetchById(customerId)
      expect(fetchedCustomer).toBeDefined()

      // Delete the customer
      const result = await remove(customerId)
      expect(result).toBe(true)

      // Verify the customer no longer exists
      fetchedCustomer = await fetchById(customerId)
      expect(fetchedCustomer).toBeUndefined()
    })
  })
})
