import { beforeEach, describe, expect, it } from 'bun:test'
import { refreshDatabase } from '@stacksjs/testing'
import { bulkDestroy, destroy } from '../waitlist/destroy'
import { fetchAll, fetchById, fetchCountBySource } from '../waitlist/fetch'
import { bulkStore, store } from '../waitlist/store'
import { update, updatePartySize, updateStatus } from '../waitlist/update'

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

describe('Waitlist Product Module', () => {
  describe('store', () => {
    it('should create a new waitlist product in the database', async () => {
      const requestData = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        party_size: 4,
        notification_preference: 'email',
        source: 'website',
        notes: 'Special request for window seat',
        status: 'waiting',
        product_id: 1,
        customer_id: 1,
      }

      const request = new TestRequest(requestData)
      const waitlistProduct = await store(request as any)

      expect(waitlistProduct).toBeDefined()
      expect(waitlistProduct?.name).toBe('John Doe')
      expect(waitlistProduct?.email).toBe('john@example.com')
      expect(waitlistProduct?.phone).toBe('+1234567890')
      expect(waitlistProduct?.party_size).toBe(4)
      expect(waitlistProduct?.notification_preference).toBe('email')
      expect(waitlistProduct?.source).toBe('website')
      expect(waitlistProduct?.notes).toBe('Special request for window seat')
      expect(waitlistProduct?.status).toBe('waiting')
      expect(waitlistProduct?.product_id).toBe(1)
      expect(waitlistProduct?.customer_id).toBe(1)
      expect(waitlistProduct?.uuid).toBeDefined()

      // Save the ID for further testing
      const waitlistId = waitlistProduct?.id !== undefined ? Number(waitlistProduct.id) : undefined

      // Verify we can fetch the waitlist product we just created
      if (waitlistId) {
        const fetchedWaitlist = await fetchById(waitlistId)
        expect(fetchedWaitlist).toBeDefined()
        expect(fetchedWaitlist?.id).toBe(waitlistId)
      }
    })

    it('should create a waitlist product with minimal required fields', async () => {
      const minimalRequestData = {
        name: 'Jane Smith',
        email: 'jane@example.com',
        party_size: 2,
        notification_preference: 'sms',
        source: 'app',
        product_id: 1,
        customer_id: 1,
      }

      const request = new TestRequest(minimalRequestData)
      const waitlistProduct = await store(request as any)

      expect(waitlistProduct).toBeDefined()
      expect(waitlistProduct?.name).toBe('Jane Smith')
      expect(waitlistProduct?.email).toBe('jane@example.com')
      expect(waitlistProduct?.party_size).toBe(2)
      expect(waitlistProduct?.notification_preference).toBe('sms')
      expect(waitlistProduct?.source).toBe('app')
      expect(waitlistProduct?.status).toBe('waiting') // Default value
      expect(waitlistProduct?.product_id).toBe(1)
      expect(waitlistProduct?.customer_id).toBe(1)
      expect(waitlistProduct?.uuid).toBeDefined()
    })

    it('should create multiple waitlist products with bulk store', async () => {
      const requests = [
        new TestRequest({
          name: 'John Doe',
          email: 'john@example.com',
          phone: '+1234567890',
          party_size: 4,
          notification_preference: 'email',
          source: 'website',
          status: 'waiting',
          product_id: 1,
          customer_id: 1,
        }),
        new TestRequest({
          name: 'Jane Smith',
          email: 'jane@example.com',
          phone: '+0987654321',
          party_size: 2,
          notification_preference: 'sms',
          source: 'app',
          status: 'waiting',
          product_id: 2,
          customer_id: 2,
        }),
        new TestRequest({
          name: 'Bob Wilson',
          email: 'bob@example.com',
          party_size: 6,
          notification_preference: 'both',
          source: 'social_media',
          status: 'waiting',
          product_id: 3,
          customer_id: 3,
        }),
      ]

      const count = await bulkStore(requests as any)
      expect(count).toBe(3)

      // Verify waitlist products can be fetched
      const allWaitlistProducts = await fetchAll()
      expect(allWaitlistProducts.length).toBeGreaterThanOrEqual(3)
    })

    it('should return 0 when trying to bulk store an empty array', async () => {
      const count = await bulkStore([])
      expect(count).toBe(0)
    })
  })

  describe('update', () => {
    it('should update an existing waitlist product', async () => {
      // First create a waitlist product to update
      const requestData = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        party_size: 4,
        notification_preference: 'email',
        source: 'website',
        status: 'waiting',
        product_id: 1,
        customer_id: 1,
      }

      // Create the waitlist product
      const createRequest = new TestRequest(requestData)
      const waitlistProduct = await store(createRequest as any)
      const waitlistId = waitlistProduct?.id !== undefined ? Number(waitlistProduct.id) : undefined

      // Make sure we have a valid waitlist ID before proceeding
      expect(waitlistId).toBeDefined()
      if (!waitlistId) {
        throw new Error('Failed to create test waitlist product')
      }

      // Update the waitlist product with new data
      const updateData = {
        name: 'John Doe Jr',
        email: 'john.jr@example.com',
        phone: '+1234567891',
        party_size: 5,
        notification_preference: 'both',
        source: 'app',
        status: 'waiting',
        product_id: 1,
        customer_id: 1,
      }

      const updateRequest = new TestRequest(updateData)
      const updatedWaitlist = await update(waitlistId, updateRequest as any)

      // Verify the update was successful
      expect(updatedWaitlist).toBeDefined()
      expect(updatedWaitlist?.id).toBe(waitlistId)
      expect(updatedWaitlist?.name).toBe('John Doe Jr')
      expect(updatedWaitlist?.email).toBe('john.jr@example.com')
      expect(updatedWaitlist?.phone).toBe('+1234567891')
      expect(updatedWaitlist?.party_size).toBe(5)
      expect(updatedWaitlist?.notification_preference).toBe('both')
      expect(updatedWaitlist?.source).toBe('app')
      expect(updatedWaitlist?.status).toBe('waiting')
    })

    it('should update a waitlist product\'s status', async () => {
      // Create a waitlist product
      const requestData = {
        name: 'John Doe',
        email: 'john@example.com',
        party_size: 4,
        notification_preference: 'email',
        source: 'website',
        status: 'waiting',
        product_id: 1,
        customer_id: 1,
      }

      const request = new TestRequest(requestData)
      const waitlistProduct = await store(request as any)
      const waitlistId = waitlistProduct?.id !== undefined ? Number(waitlistProduct.id) : undefined

      // Make sure we have a valid waitlist ID before proceeding
      expect(waitlistId).toBeDefined()
      if (!waitlistId) {
        throw new Error('Failed to create test waitlist product')
      }

      // Update status to notified
      const updatedWaitlist = await updateStatus(waitlistId, 'notified')
      expect(updatedWaitlist).toBeDefined()
      expect(updatedWaitlist?.status).toBe('notified')

      // Update status to purchased
      const purchasedWaitlist = await updateStatus(waitlistId, 'purchased')
      expect(purchasedWaitlist).toBeDefined()
      expect(purchasedWaitlist?.status).toBe('purchased')
    })

    it('should update party size', async () => {
      // Create a waitlist product
      const requestData = {
        name: 'John Doe',
        email: 'john@example.com',
        party_size: 4,
        notification_preference: 'email',
        source: 'website',
        status: 'waiting',
        product_id: 1,
        customer_id: 1,
      }

      const request = new TestRequest(requestData)
      const waitlistProduct = await store(request as any)
      const waitlistId = waitlistProduct?.id !== undefined ? Number(waitlistProduct.id) : undefined

      expect(waitlistId).toBeDefined()
      if (!waitlistId) {
        throw new Error('Failed to create test waitlist product')
      }

      // Update party size
      const updatedWaitlist = await updatePartySize(waitlistId, 6)

      expect(updatedWaitlist).toBeDefined()
      expect(updatedWaitlist?.party_size).toBe(6)
    })
  })

  describe('destroy', () => {
    it('should delete a waitlist product from the database', async () => {
      // First create a waitlist product to delete
      const requestData = {
        name: 'John Doe',
        email: 'john@example.com',
        party_size: 4,
        notification_preference: 'email',
        source: 'website',
        status: 'waiting',
        product_id: 1,
        customer_id: 1,
      }

      // Create the waitlist product
      const request = new TestRequest(requestData)
      const waitlistProduct = await store(request as any)
      const waitlistId = waitlistProduct?.id !== undefined ? Number(waitlistProduct.id) : undefined

      // Make sure we have a valid waitlist ID before proceeding
      expect(waitlistId).toBeDefined()
      if (!waitlistId) {
        throw new Error('Failed to create test waitlist product')
      }

      // Verify the waitlist product exists
      let fetchedWaitlist = await fetchById(waitlistId)
      expect(fetchedWaitlist).toBeDefined()

      // Delete the waitlist product
      const deletedWaitlist = await destroy(waitlistId)
      expect(deletedWaitlist).toBeDefined()
      expect(deletedWaitlist?.id).toBe(waitlistId)

      // Verify the waitlist product no longer exists
      fetchedWaitlist = await fetchById(waitlistId)
      expect(fetchedWaitlist).toBeUndefined()
    })

    it('should return 0 when trying to delete an empty array of waitlist products', async () => {
      // Try to delete with an empty array
      const deletedCount = await bulkDestroy([])
      expect(deletedCount).toBe(0)
    })
  })

  describe('fetch', () => {
    it('should fetch count of waitlist products grouped by source', async () => {
      // Create test waitlist products with different sources
      const requests = [
        new TestRequest({
          name: 'John Doe',
          email: 'john@example.com',
          party_size: 4,
          notification_preference: 'email',
          source: 'website',
          status: 'waiting',
          product_id: 1,
          customer_id: 1,
        }),
        new TestRequest({
          name: 'Jane Smith',
          email: 'jane@example.com',
          party_size: 2,
          notification_preference: 'sms',
          source: 'website',
          status: 'waiting',
          product_id: 2,
          customer_id: 2,
        }),
        new TestRequest({
          name: 'Bob Wilson',
          email: 'bob@example.com',
          party_size: 6,
          notification_preference: 'both',
          source: 'app',
          status: 'waiting',
          product_id: 3,
          customer_id: 3,
        }),
        new TestRequest({
          name: 'Alice Brown',
          email: 'alice@example.com',
          party_size: 3,
          notification_preference: 'email',
          source: 'social_media',
          status: 'waiting',
          product_id: 4,
          customer_id: 4,
        }),
      ]

      // Create the waitlist products
      await bulkStore(requests as any)

      // Fetch the counts by source
      const sourceCounts = await fetchCountBySource()

      // Verify the counts
      expect(sourceCounts).toBeDefined()
      expect(Object.keys(sourceCounts).length).toBe(3) // website, app, social_media

      // Verify each source count
      expect(sourceCounts.website).toBe(2)
      expect(sourceCounts.app).toBe(1)
      expect(sourceCounts.social_media).toBe(1)
    })

    it('should return empty object when no waitlist products exist', async () => {
      const sourceCounts = await fetchCountBySource()
      expect(sourceCounts).toBeDefined()
      expect(Object.keys(sourceCounts).length).toBe(0)
    })
  })
})
