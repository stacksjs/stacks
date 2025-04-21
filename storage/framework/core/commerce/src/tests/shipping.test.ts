import { beforeEach, describe, expect, it } from 'bun:test'
import { refreshDatabase } from '@stacksjs/testing'
import { bulkDestroy, bulkSoftDelete, destroy, softDelete } from '../shippings/shipping-methods/destroy'
import { fetchById } from '../shippings/shipping-methods/fetch'
import { bulkStore, formatShippingOptions, getActiveShippingMethods, store } from '../shippings/shipping-methods/store'
import { update, updatePricing, updateStatus } from '../shippings/shipping-methods/update'

beforeEach(async () => {
  await refreshDatabase()
})

describe('Shipping Methods Module', () => {
  describe('store', () => {
    it('should create a new shipping method in the database', async () => {
      const requestData = {
        name: 'Express Delivery',
        description: 'Next day delivery service',
        base_rate: 1500, // $15.00
        free_shipping: 10000, // Free for orders over $100
        status: 'active',
      }

      const shippingMethod = await store(requestData)

      expect(shippingMethod).toBeDefined()
      expect(shippingMethod?.name).toBe('Express Delivery')
      expect(shippingMethod?.description).toBe('Next day delivery service')
      expect(shippingMethod?.base_rate).toBe(1500)
      expect(shippingMethod?.free_shipping).toBe(10000)
      expect(shippingMethod?.status).toBe('active')
      expect(shippingMethod?.uuid).toBeDefined()

      // Save the ID for further testing
      const methodId = shippingMethod?.id !== undefined ? Number(shippingMethod.id) : undefined

      // Verify we can fetch the shipping method we just created
      if (methodId) {
        const fetchedMethod = await fetchById(methodId)
        expect(fetchedMethod).toBeDefined()
        expect(fetchedMethod?.id).toBe(methodId)
      }
    })

    it('should create a shipping method with default values when optional fields are missing', async () => {
      // Create a shipping method with only required fields
      const minimalRequestData = {
        name: 'Standard Shipping',
        base_rate: 500,
        status: 'active',
      }

      const shippingMethod = await store(minimalRequestData)

      expect(shippingMethod).toBeDefined()
      expect(shippingMethod?.name).toBe('Standard Shipping')
      expect(shippingMethod?.base_rate).toBe(500)
      expect(shippingMethod?.status).toBe('active')
      expect(shippingMethod?.description).toBeNull() // Optional field should be null
    })

    it('should create multiple shipping methods at once', async () => {
      const requests = [
        {
          name: 'Standard Shipping',
          base_rate: 500,
          status: 'active',
        },
        {
          name: 'Express Shipping',
          base_rate: 1500,
          zones: JSON.stringify(['North America', 'Europe']),
          status: 'active',
        },
      ]

      const createdCount = await bulkStore(requests)
      expect(createdCount).toBe(2)

      // Verify we can retrieve active shipping methods
      const activeMethods = await getActiveShippingMethods()
      expect(activeMethods.length).toBe(2)
    })

    it('should format shipping options correctly', async () => {
      // Create test shipping methods
      const request1 = {
        name: 'Standard Shipping',
        base_rate: 500,
        status: 'active',
      }

      await store(request1)

      const request2 = {
        name: 'Express Shipping',
        base_rate: 1500,
        zones: JSON.stringify(['North America', 'Europe']),
        status: 'active',
      }

      await store(request2)

      // Get formatted options
      const options = await formatShippingOptions()

      expect(options.length).toBe(2)
      expect(options[0].name).toBeDefined()
      expect(options[0].base_rate).toBeDefined()
      expect(options[0].status).toBeDefined()
    })
  })

  describe('update', () => {
    it('should update an existing shipping method', async () => {
      // First create a shipping method to update
      const requestData = {
        name: 'Initial Shipping',
        description: 'Initial description',
        base_rate: 1000,
        free_shipping: 5000,
        status: 'active',
      }

      // Create the shipping method
      const method = await store(requestData)
      const methodId = method?.id !== undefined ? Number(method.id) : undefined

      // Make sure we have a valid ID before proceeding
      expect(methodId).toBeDefined()
      if (!methodId) {
        throw new Error('Failed to create test shipping method')
      }

      const updateData = {
        name: 'Updated Shipping',
        description: 'Updated description',
        base_rate: 1200,
        free_shipping: 7500,
        status: 'active',
      }

      const updatedMethod = await update(methodId, updateData)

      // Verify the update was successful
      expect(updatedMethod).toBeDefined()
      expect(updatedMethod?.id).toBe(methodId)
      expect(updatedMethod?.name).toBe('Updated Shipping')
      expect(updatedMethod?.description).toBe('Updated description')
      expect(updatedMethod?.base_rate).toBe(1200)
      expect(updatedMethod?.free_shipping).toBe(7500)
    })

    it('should update a shipping method\'s status', async () => {
      // Create a shipping method
      const requestData = {
        name: 'Status Test Shipping',
        base_rate: 1000,
        status: 'active',
      }

      const method = await store(requestData)
      const methodId = method?.id !== undefined ? Number(method.id) : undefined

      // Make sure we have a valid ID before proceeding
      expect(methodId).toBeDefined()
      if (!methodId) {
        throw new Error('Failed to create test shipping method')
      }

      // Update the status to inactive
      const updatedMethod = await updateStatus(methodId, 'inactive')
      expect(updatedMethod?.status).toBe('inactive')

      // The original fields should remain unchanged
      expect(updatedMethod?.name).toBe('Status Test Shipping')
      expect(updatedMethod?.base_rate).toBe(1000)
    })

    it('should update pricing information for a shipping method', async () => {
      // Create a shipping method
      const requestData = {
        name: 'Pricing Test Shipping',
        base_rate: 1000,
        free_shipping: 5000,
        status: 'active',
      }

      const method = await store(requestData)
      const methodId = method?.id !== undefined ? Number(method.id) : undefined

      // Make sure we have a valid ID before proceeding
      expect(methodId).toBeDefined()
      if (!methodId) {
        throw new Error('Failed to create test shipping method')
      }

      // Update just the base_rate
      const updatedBaseRate = await updatePricing(methodId, 1200)
      expect(updatedBaseRate?.base_rate).toBe(1200)
      expect(updatedBaseRate?.free_shipping).toBe(5000)

      // Update just the free_shipping threshold
      const updatedFreeShipping = await updatePricing(methodId, undefined, 7500)
      expect(updatedFreeShipping?.base_rate).toBe(1200)
      expect(updatedFreeShipping?.free_shipping).toBe(7500)

      // Update both values
      const updatedBoth = await updatePricing(methodId, 1500, 10000)
      expect(updatedBoth?.base_rate).toBe(1500)
      expect(updatedBoth?.free_shipping).toBe(10000)
    })
  })

  describe('destroy', () => {
    it('should delete a shipping method from the database', async () => {
      // First create a shipping method to delete
      const requestData = {
        name: 'Method to Delete',
        base_rate: 1000,
        status: 'active',
      }

      // Create the shipping method
      const method = await store(requestData)
      const methodId = method?.id !== undefined ? Number(method.id) : undefined

      // Make sure we have a valid ID before proceeding
      expect(methodId).toBeDefined()
      if (!methodId) {
        throw new Error('Failed to create test shipping method')
      }

      // Verify the shipping method exists
      let fetchedMethod = await fetchById(methodId)
      expect(fetchedMethod).toBeDefined()

      // Delete the shipping method
      const result = await destroy(methodId)
      expect(result).toBe(true)

      // Verify the shipping method no longer exists
      fetchedMethod = await fetchById(methodId)
      expect(fetchedMethod).toBeUndefined()
    })

    it('should soft delete a shipping method by updating its status', async () => {
      // Create a shipping method to soft delete
      const requestData = {
        name: 'Method to Soft Delete',
        base_rate: 1000,
        status: 'active',
      }

      const method = await store(requestData)
      const methodId = method?.id !== undefined ? Number(method.id) : undefined

      // Make sure we have a valid ID before proceeding
      expect(methodId).toBeDefined()
      if (!methodId) {
        throw new Error('Failed to create test shipping method')
      }

      // Soft delete the shipping method
      const result = await softDelete(methodId)
      expect(result).toBe(true)

      // Verify the shipping method still exists but has inactive status
      const fetchedMethod = await fetchById(methodId)
      expect(fetchedMethod).toBeDefined()
      expect(fetchedMethod?.status).toBe('inactive')
    })

    it('should delete multiple shipping methods from the database', async () => {
      // Create several shipping methods to delete
      const methodIds: number[] = []

      // Create 3 test shipping methods
      for (let i = 0; i < 3; i++) {
        const requestData = {
          name: `Bulk Delete Method ${i}`,
          base_rate: 1000 + i * 100,
          zones: JSON.stringify(['North America']),
          status: 'active',
        }

        const method = await store(requestData)

        const methodId = method?.id !== undefined ? Number(method.id) : undefined
        expect(methodId).toBeDefined()

        if (methodId) {
          methodIds.push(methodId)
        }
      }

      // Ensure we have created the shipping methods
      expect(methodIds.length).toBe(3)

      // Delete the shipping methods
      const deletedCount = await bulkDestroy(methodIds)
      expect(deletedCount).toBe(3)

      // Verify the shipping methods no longer exist
      for (const id of methodIds) {
        const fetchedMethod = await fetchById(id)
        expect(fetchedMethod).toBeUndefined()
      }
    })

    it('should soft delete multiple shipping methods', async () => {
      // Create several shipping methods to soft delete
      const methodIds: number[] = []

      // Create 3 test shipping methods
      for (let i = 0; i < 3; i++) {
        const requestData = {
          name: `Bulk Soft Delete Method ${i}`,
          base_rate: 1000 + i * 100,
          zones: JSON.stringify(['North America']),
          status: 'active',
        }

        const method = await store(requestData)

        const methodId = method?.id !== undefined ? Number(method.id) : undefined
        expect(methodId).toBeDefined()

        if (methodId) {
          methodIds.push(methodId)
        }
      }

      // Ensure we have created the shipping methods
      expect(methodIds.length).toBe(3)

      // Soft delete the shipping methods
      const softDeletedCount = await bulkSoftDelete(methodIds)
      expect(softDeletedCount).toBe(3)

      // Verify the shipping methods still exist but have inactive status
      for (const id of methodIds) {
        const fetchedMethod = await fetchById(id)
        expect(fetchedMethod).toBeDefined()
        expect(fetchedMethod?.status).toBe('inactive')
      }

      // Verify they don't appear in active shipping methods
      const activeMethods = await getActiveShippingMethods()
      const hasAnyTestMethod = activeMethods.some(method =>
        methodIds.includes(Number(method.id)),
      )
      expect(hasAnyTestMethod).toBe(false)
    })

    it('should return 0 when trying to delete an empty array of shipping methods', async () => {
      // Try to delete with an empty array
      const deletedCount = await bulkDestroy([])
      expect(deletedCount).toBe(0)

      // Try to soft delete with an empty array
      const softDeletedCount = await bulkSoftDelete([])
      expect(softDeletedCount).toBe(0)
    })
  })

  describe('fetch', () => {
    it('should get active shipping methods only', async () => {
      // Create an active shipping method
      const activeRequest = {
        name: 'Active Shipping',
        base_rate: 1000,
        status: 'active',
      }
      await store(activeRequest)

      // Create an inactive shipping method
      const inactiveRequest = {
        name: 'Inactive Shipping',
        base_rate: 1500,
        status: 'inactive',
      }
      await store(inactiveRequest)

      // Create a draft shipping method
      const draftRequest = {
        name: 'Draft Shipping',
        base_rate: 2000,
        status: 'draft',
      }
      await store(draftRequest)

      // Get active shipping methods
      const activeMethods = await getActiveShippingMethods()

      // Should only return active methods
      expect(activeMethods.length).toBe(1)
      expect(activeMethods[0].name).toBe('Active Shipping')
      expect(activeMethods[0].status).toBe('active')
    })
  })
})
