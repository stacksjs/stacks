import { beforeEach, describe, expect, it } from 'bun:test'
import { refreshDatabase } from '@stacksjs/testing'
import { bulkDestroy, bulkSoftDelete } from '../shippings/shipping-methods/destroy'
import { formatShippingOptions, getActiveShippingMethods, store } from '../shippings/shipping-methods/store'

beforeEach(async () => {
  await refreshDatabase()
})

describe('Shipping Methods Module', () => {
  describe('store', () => {
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

  describe('destroy', () => {
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
