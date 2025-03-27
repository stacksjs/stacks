import { beforeEach, describe, expect, it } from 'bun:test'
import { refreshDatabase } from '@stacksjs/testing'
import { bulkDestroy, bulkSoftDelete, destroy, softDelete } from '../license/destroy'
import { fetchAll, fetchById } from '../license/fetch'
import { bulkStore, store } from '../license/store'
import { update, updateExpiration, updateStatus } from '../license/update'
import { formatDate } from '@stacksjs/orm'

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

describe('License Key Module', () => {
  describe('store', () => {
    it('should create a new license key in the database', async () => {
      const requestData = {
        key: 'XXXX-XXXX-XXXX-XXXX-XXXX',
        template: 'Premium License',
        expiry_date: formatDate(new Date('2025-12-31')),
        status: 'active',
        customer_id: 1,
        product_id: 1,
        order_id: 1,
      }

      const request = new TestRequest(requestData)
      const license = await store(request as any)

      expect(license).toBeDefined()
      expect(license?.key).toBe('XXXX-XXXX-XXXX-XXXX-XXXX')
      expect(license?.template).toBe('Premium License')
      expect(license?.expiry_date).toBeDefined()
      expect(license?.status).toBe('active')
      expect(license?.customer_id).toBe(1)
      expect(license?.product_id).toBe(1)
      expect(license?.order_id).toBe(1)
      expect(license?.uuid).toBeDefined()

      // Save the ID for further testing
      const licenseId = license?.id !== undefined ? Number(license.id) : undefined

      // Verify we can fetch the license we just created
      if (licenseId) {
        const fetchedLicense = await fetchById(licenseId)
        expect(fetchedLicense).toBeDefined()
        expect(fetchedLicense?.id).toBe(licenseId)
      }
    })

    it('should create a license key with minimal required fields', async () => {
      const minimalRequestData = {
        key: 'XXXX-XXXX-XXXX-XXXX-XXXX',
        template: 'Standard License',
        expiry_date: formatDate(new Date('2025-12-31')),
        status: 'unassigned',
      }

      const request = new TestRequest(minimalRequestData)
      const license = await store(request as any)

      expect(license).toBeDefined()
      expect(license?.key).toBe('XXXX-XXXX-XXXX-XXXX-XXXX')
      expect(license?.template).toBe('Standard License')
      expect(license?.expiry_date).toBeDefined()
      expect(license?.status).toBe('unassigned')
      expect(license?.uuid).toBeDefined()
    })

    it('should create multiple license keys with bulk store', async () => {
      const requests = [
        new TestRequest({
          key: 'XXXX-XXXX-XXXX-XXXX-XXXX',
          template: 'Standard License',
          expiry_date: formatDate(new Date('2025-12-31')),
          status: 'unassigned',
        }),
        new TestRequest({
          key: 'YYYY-YYYY-YYYY-YYYY-YYYY',
          template: 'Premium License',
          expiry_date: formatDate(new Date('2026-12-31')),
          status: 'unassigned',
        }),
        new TestRequest({
          key: 'ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ',
          template: 'Enterprise License',
          expiry_date: formatDate(new Date('2027-12-31')),
          status: 'unassigned',
        }),
      ]

      const count = await bulkStore(requests as any)
      expect(count).toBe(3)

      // Verify licenses can be fetched
      const allLicenses = await fetchAll()
      expect(allLicenses.length).toBeGreaterThanOrEqual(3)
    })

    it('should return 0 when trying to bulk store an empty array', async () => {
      const count = await bulkStore([])
      expect(count).toBe(0)
    })
  })

  describe('update', () => {
    it('should update an existing license key', async () => {
      // First create a license to update
      const requestData = {
        key: 'XXXX-XXXX-XXXX-XXXX-XXXX',
        template: 'Standard License',
        expiry_date: formatDate(new Date('2025-12-31')),
        status: 'unassigned',
      }

      // Create the license
      const createRequest = new TestRequest(requestData)
      const license = await store(createRequest as any)
      const licenseId = license?.id !== undefined ? Number(license.id) : undefined

      // Make sure we have a valid license ID before proceeding
      expect(licenseId).toBeDefined()
      if (!licenseId) {
        throw new Error('Failed to create test license key')
      }

      // Update the license with new data
      const updateData = {
        key: 'YYYY-YYYY-YYYY-YYYY-YYYY',
        template: 'Premium License',
        expiry_date: formatDate(new Date('2026-12-31')),
        status: 'active',
        customer_id: 1,
        product_id: 1,
        order_id: 1,
      }

      const updateRequest = new TestRequest(updateData)
      const updatedLicense = await update(licenseId, updateRequest as any)

      // Verify the update was successful
      expect(updatedLicense).toBeDefined()
      expect(updatedLicense?.id).toBe(licenseId)
      expect(updatedLicense?.key).toBe('YYYY-YYYY-YYYY-YYYY-YYYY')
      expect(updatedLicense?.template).toBe('Premium License')
      expect(updatedLicense?.expiry_date).toBeDefined()
      expect(updatedLicense?.status).toBe('active')
      expect(updatedLicense?.customer_id).toBe(1)
      expect(updatedLicense?.product_id).toBe(1)
      expect(updatedLicense?.order_id).toBe(1)
    })

    it('should update a license key\'s status', async () => {
      // Create a license
      const requestData = {
        key: 'XXXX-XXXX-XXXX-XXXX-XXXX',
        template: 'Standard License',
        expiry_date: formatDate(new Date('2025-12-31')),
        status: 'unassigned',
      }

      const request = new TestRequest(requestData)
      const license = await store(request as any)
      const licenseId = license?.id !== undefined ? Number(license.id) : undefined

      // Make sure we have a valid license ID before proceeding
      expect(licenseId).toBeDefined()
      if (!licenseId) {
        throw new Error('Failed to create test license key')
      }

      // Update status to active
      const updatedLicense = await updateStatus(licenseId, 'active')
      expect(updatedLicense).toBeDefined()
      expect(updatedLicense?.status).toBe('active')

      // Update status to inactive
      const deactivatedLicense = await updateStatus(licenseId, 'inactive')
      expect(deactivatedLicense).toBeDefined()
      expect(deactivatedLicense?.status).toBe('inactive')
    })

    it('should update expiration information', async () => {
      // Create a license
      const requestData = {
        key: 'XXXX-XXXX-XXXX-XXXX-XXXX',
        template: 'Standard License',
        expiry_date: formatDate(new Date('2026-12-31')),
        status: 'unassigned',
      }

      const request = new TestRequest(requestData)
      const license = await store(request as any)
      const licenseId = license?.id !== undefined ? Number(license.id) : undefined

      expect(licenseId).toBeDefined()
      if (!licenseId) {
        throw new Error('Failed to create test license key')
      }

      // Update expiry date
      const newExpiryDate = formatDate(new Date('2026-12-31'))
      const updatedLicense = await updateExpiration(licenseId, newExpiryDate)

      expect(updatedLicense).toBeDefined()
      expect(updatedLicense?.expiry_date).toBeDefined()
      expect(updatedLicense?.expiry_date).toEqual(newExpiryDate)
    })
  })

  describe('destroy', () => {
    it('should delete a license key from the database', async () => {
      // First create a license to delete
      const requestData = {
        key: 'XXXX-XXXX-XXXX-XXXX-XXXX',
        template: 'Standard License',
        expiry_date: formatDate(new Date('2025-12-31')),
        status: 'unassigned',
      }

      // Create the license
      const request = new TestRequest(requestData)
      const license = await store(request as any)
      const licenseId = license?.id !== undefined ? Number(license.id) : undefined

      // Make sure we have a valid license ID before proceeding
      expect(licenseId).toBeDefined()
      if (!licenseId) {
        throw new Error('Failed to create test license key')
      }

      // Verify the license exists
      let fetchedLicense = await fetchById(licenseId)
      expect(fetchedLicense).toBeDefined()

      // Delete the license
      const result = await destroy(licenseId)
      expect(result).toBe(true)

      // Verify the license no longer exists
      fetchedLicense = await fetchById(licenseId)
      expect(fetchedLicense).toBeUndefined()
    })

    it('should soft delete a license key', async () => {
      // Create a license
      const requestData = {
        key: 'XXXX-XXXX-XXXX-XXXX-XXXX',
        template: 'Standard License',
        expiry_date: formatDate(new Date('2025-12-31')),
        status: 'unassigned',
      }

      // Create the license
      const request = new TestRequest(requestData)
      const license = await store(request as any)
      const licenseId = license?.id !== undefined ? Number(license.id) : undefined

      expect(licenseId).toBeDefined()
      if (!licenseId) {
        throw new Error('Failed to create test license key')
      }

      // Soft delete the license
      const result = await softDelete(licenseId)
      expect(result).toBe(true)

      // Verify the license still exists but is inactive
      const fetchedLicense = await fetchById(licenseId)
      expect(fetchedLicense).toBeDefined()
      expect(fetchedLicense?.status).toBe('inactive')
    })

    it('should delete multiple license keys from the database', async () => {
      // Create several licenses to delete
      const licenseIds = []

      // Create 3 test licenses
      for (let i = 0; i < 3; i++) {
        const requestData = {
          key: `XXXX-XXXX-XXXX-XXXX-${i.toString().padStart(4, '0')}`,
          template: 'Standard License',
          expiry_date: formatDate(new Date('2025-12-31')),
          status: 'unassigned',
        }

        const request = new TestRequest(requestData)
        const license = await store(request as any)

        const licenseId = license?.id !== undefined ? Number(license.id) : undefined
        expect(licenseId).toBeDefined()

        if (licenseId) {
          licenseIds.push(licenseId)
        }
      }

      // Ensure we have created the licenses
      expect(licenseIds.length).toBe(3)

      // Delete the licenses
      const deletedCount = await bulkDestroy(licenseIds)
      expect(deletedCount).toBe(3)

      // Verify the licenses no longer exist
      for (const id of licenseIds) {
        const fetchedLicense = await fetchById(id)
        expect(fetchedLicense).toBeUndefined()
      }
    })

    it('should soft delete multiple license keys', async () => {
      // Create several licenses to soft delete
      const licenseIds = []

      // Create 3 test licenses
      for (let i = 0; i < 3; i++) {
        const requestData = {
          key: `XXXX-XXXX-XXXX-XXXX-${i.toString().padStart(4, '0')}`,
          template: 'Standard License',
          expiry_date: formatDate(new Date('2025-12-31')),
          status: 'unassigned',
        }

        const request = new TestRequest(requestData)
        const license = await store(request as any)

        const licenseId = license?.id !== undefined ? Number(license.id) : undefined
        expect(licenseId).toBeDefined()

        if (licenseId) {
          licenseIds.push(licenseId)
        }
      }

      // Ensure we have created the licenses
      expect(licenseIds.length).toBe(3)

      // Soft delete the licenses
      const deletedCount = await bulkSoftDelete(licenseIds)
      expect(deletedCount).toBe(3)

      // Verify the licenses still exist but are inactive
      for (const id of licenseIds) {
        const fetchedLicense = await fetchById(id)
        expect(fetchedLicense).toBeDefined()
        expect(fetchedLicense?.status).toBe('inactive')
      }
    })

    it('should return 0 when trying to delete an empty array of licenses', async () => {
      // Try to delete with an empty array
      const deletedCount = await bulkDestroy([])
      expect(deletedCount).toBe(0)
    })

    it('should return 0 when trying to soft delete an empty array of licenses', async () => {
      // Try to soft delete with an empty array
      const deletedCount = await bulkSoftDelete([])
      expect(deletedCount).toBe(0)
    })
  })
})
