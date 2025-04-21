import { beforeEach, describe, expect, it } from 'bun:test'
import { refreshDatabase } from '@stacksjs/testing'
import { destroy } from '../customers/destroy'
import { fetchById } from '../customers/fetch'
import { store } from '../customers/store'
import { update } from '../customers/update'

beforeEach(async () => {
  await refreshDatabase()
})

describe('Customer Module', () => {
  describe('store', () => {
    it('should create a new customer in the database', async () => {
      // Create a unique email to avoid conflicts
      const uniqueEmail = `test-${Date.now()}@example.com`

      const customerData = {
        name: 'Test Customer',
        email: uniqueEmail,
        phone: '555-123-4567',
        status: 'Active',
        user_id: 1,
      }

      const customer = await store(customerData)

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

    it('should throw an error when trying to create a customer with a duplicate email', async () => {
      // Create a unique email to avoid conflicts
      const uniqueEmail = `test-duplicate-${Date.now()}@example.com`

      // Create first customer
      const firstCustomerData = {
        name: 'First Test Customer',
        email: uniqueEmail,
        phone: '555-123-4567',
        status: 'Active',
        user_id: 1,
      }

      const firstCustomer = await store(firstCustomerData)
      expect(firstCustomer).toBeDefined()

      // Try to create a second customer with the same email
      const secondCustomerData = {
        name: 'Second Test Customer',
        email: uniqueEmail, // Same email as the first customer
        phone: '555-987-6543',
        status: 'Active',
        user_id: 2,
      }

      try {
        await store(secondCustomerData)
        // If we get here, the test should fail as we expect an error
        expect(true).toBe(false) // This line should not be reached
      }
      catch (error) {
        expect(error).toBeDefined()
        expect(error instanceof Error).toBe(true)
        // Check for both possible error message formats
        const errorMessage = (error as Error).message
        expect(
          errorMessage.includes('A customer with this email already exists')
          || errorMessage.includes('UNIQUE constraint failed: customers.email'),
        ).toBe(true)
      }
    })

    it('should create a customer with default values when optional fields are missing', async () => {
      // Create a customer with only required fields
      const uniqueEmail = `test-defaults-${Date.now()}@example.com`

      const minimalCustomerData = {
        name: 'Minimal Customer',
        email: uniqueEmail,
        phone: '555-123-9876',
        user_id: 1,
        status: 'Active',
        // Other fields are omitted to test defaults
      }

      const customer = await store(minimalCustomerData)

      expect(customer).toBeDefined()
      expect(customer?.name).toBe('Minimal Customer')
      expect(customer?.email).toBe(uniqueEmail)
      expect(customer?.status).toBe('Active') // Default value
      expect(customer?.avatar).toContain('unsplash.com') // Default avatar URL
    })
  })

  describe('fetchById', () => {
    it('should fetch a customer by ID', async () => {
      // First create a customer to fetch
      const uniqueEmail = `test-fetch-${Date.now()}@example.com`
      const customerData = {
        name: 'Fetch Test Customer',
        email: uniqueEmail,
        phone: '555-987-6543',
        status: 'Active',
        user_id: 1,
      }

      const customer = await store(customerData)
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
      const customer = await store(initialData)
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

      const updatedCustomer = await update(customerId, updateData)

      // Verify the update was successful
      expect(updatedCustomer).toBeDefined()
      expect(updatedCustomer?.id).toBe(customerId)
      expect(updatedCustomer?.name).toBe('Updated Customer Name')
      expect(updatedCustomer?.phone).toBe('555-333-4444')

      // The email should remain unchanged
      expect(updatedCustomer?.email).toBe(uniqueEmail)
    })

    it('should throw an error when trying to update a customer with an existing email', async () => {
      // Create two customers with unique emails
      const email1 = `test-update-conflict-1-${Date.now()}@example.com`
      const email2 = `test-update-conflict-2-${Date.now()}@example.com`

      // Create first customer
      const firstCustomerData = {
        name: 'First Update Conflict Customer',
        email: email1,
        phone: '555-111-2222',
        status: 'Active',
        user_id: 1,
      }

      const firstCustomer = await store(firstCustomerData)
      const firstCustomerId = firstCustomer?.id !== undefined ? Number(firstCustomer.id) : undefined
      expect(firstCustomerId).toBeDefined()

      // Create second customer
      const secondCustomerData = {
        name: 'Second Update Conflict Customer',
        email: email2,
        phone: '555-333-4444',
        status: 'Active',
        user_id: 1,
      }

      const secondCustomer = await store(secondCustomerData)
      const secondCustomerId = secondCustomer?.id !== undefined ? Number(secondCustomer.id) : undefined
      expect(secondCustomerId).toBeDefined()

      if (!firstCustomerId || !secondCustomerId)
        throw new Error('Failed to create test customers')

      // Try to update the second customer with the first customer's email
      const updateData = {
        email: email1, // This should conflict with the first customer
      }

      try {
        await update(secondCustomerId, updateData)
        // If we get here, the test should fail as we expect an error
        expect(true).toBe(false) // This line should not be reached
      }
      catch (error) {
        expect(error).toBeDefined()
        expect(error instanceof Error).toBe(true)
        // Check for both possible error message formats
        const errorMessage = (error as Error).message
        expect(
          errorMessage.includes('A customer with this email already exists')
          || errorMessage.includes('UNIQUE constraint failed: customers.email'),
        ).toBe(true)
      }
    })
  })

  describe('remove', () => {
    it('should delete a customer from the database', async () => {
      // First create a customer to delete
      const uniqueEmail = `test-delete-${Date.now()}@example.com`
      const customerData = {
        name: 'Delete Test Customer',
        email: uniqueEmail,
        phone: '555-999-8888',
        status: 'Active',
        user_id: 1,
      }

      // Create the customer
      const customer = await store(customerData)
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
      const result = await destroy(customerId)
      expect(result).toBe(true)

      // Verify the customer no longer exists
      fetchedCustomer = await fetchById(customerId)
      expect(fetchedCustomer).toBeUndefined()
    })

    it('should throw an error when trying to delete a non-existent customer', async () => {
      // Use a very large ID that is unlikely to exist
      const nonExistentId = 99999999

      // Attempt to delete and expect an error
      try {
        await destroy(nonExistentId)
        // If we get here, the test should fail as we expect an error
        expect(true).toBe(false) // This line should not be reached
      }
      catch (error) {
        expect(error).toBeDefined()
        expect(error instanceof Error).toBe(true)
        expect((error as Error).message).toContain(`Customer with ID ${nonExistentId} not found`)
      }
    })
  })

  describe('bulkRemove', () => {
    it('should delete multiple customers from the database', async () => {
      // First create multiple customers to delete
      const customers = []
      const customerIds = []

      // Create 3 test customers
      for (let i = 0; i < 3; i++) {
        const uniqueEmail = `test-bulk-delete-${i}-${Date.now()}@example.com`
        const customerData = {
          name: `Bulk Delete Test Customer ${i}`,
          email: uniqueEmail,
          phone: `555-999-${1000 + i}`,
          status: 'Active',
          user_id: 1,
        }

        const customer = await store(customerData)
        expect(customer).toBeDefined()

        const customerId = customer?.id !== undefined ? Number(customer.id) : undefined
        expect(customerId).toBeDefined()

        if (customerId) {
          customerIds.push(customerId)
          customers.push(customer)
        }
      }

      // Ensure we have created the customers
      expect(customerIds.length).toBe(3)

      // Import the bulkRemove function
      const { bulkDestroy } = await import('../customers/destroy')

      // Delete the customers
      const deletedCount = await bulkDestroy(customerIds)
      expect(deletedCount).toBe(3)

      // Verify the customers no longer exist
      for (const id of customerIds) {
        const fetchedCustomer = await fetchById(id)
        expect(fetchedCustomer).toBeUndefined()
      }
    })

    it('should return 0 when trying to delete an empty array of customers', async () => {
      // Import the bulkRemove function
      const { bulkDestroy } = await import('../customers/destroy')

      // Try to delete with an empty array
      const deletedCount = await bulkDestroy([])
      expect(deletedCount).toBe(0)
    })
  })
})
