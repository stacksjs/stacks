import type { WaitlistProductJsonResponse } from '@stacksjs/orm'
import { beforeEach, describe, expect, it } from 'bun:test'
import { formatDate } from '@stacksjs/orm'
import { refreshDatabase } from '@stacksjs/testing'
import { bulkDestroy, destroy } from '../waitlists/products/destroy'
import {
  fetchAll,
  fetchBetweenDates,
  fetchById,
  fetchCancelledBetweenDates,
  fetchConversionRates,
  fetchCountByAllQuantities,
  fetchCountByDate,
  fetchCountByQuantity,
  fetchCountBySource,
  fetchNotifiedBetweenDates,
  fetchPurchasedBetweenDates,
  fetchWaiting,
} from '../waitlists/products/fetch'
import { bulkStore, store } from '../waitlists/products/store'
import { update, updatePartySize, updateStatus } from '../waitlists/products/update'

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
        quantity: 1,
      }

      const waitlistProduct = await store(requestData)

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
        quantity: 1,
        customer_id: 1,
        status: 'waiting',
      }

      const waitlistProduct = await store(minimalRequestData)

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
        {
          name: 'John Doe',
          email: 'john@example.com',
          phone: '+1234567890',
          party_size: 4,
          notification_preference: 'email',
          source: 'website',
          status: 'waiting',
          product_id: 1,
          customer_id: 1,
          quantity: 1,
        },
        {
          name: 'Jane Smith',
          email: 'jane@example.com',
          phone: '+0987654321',
          party_size: 2,
          notification_preference: 'sms',
          source: 'app',
          status: 'waiting',
          product_id: 2,
          customer_id: 2,
          quantity: 1,
        },
        {
          name: 'Bob Wilson',
          email: 'bob@example.com',
          party_size: 6,
          notification_preference: 'both',
          source: 'social_media',
          status: 'waiting',
          product_id: 3,
          customer_id: 3,
          quantity: 1,
        },
      ]

      const count = await bulkStore(requests)
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
        quantity: 1,
      }

      // Create the waitlist product
      const waitlistProduct = await store(requestData)
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
        quantity: 1,
      }

      const updatedWaitlist = await update(waitlistId, updateData)

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
        quantity: 1,
      }

      const waitlistProduct = await store(requestData)
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
        quantity: 1,
      }

      const waitlistProduct = await store(requestData)
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
        quantity: 1,
      }

      // Create the waitlist product
      const waitlistProduct = await store(requestData)
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
        {
          name: 'John Doe',
          email: 'john@example.com',
          party_size: 4,
          notification_preference: 'email',
          source: 'website',
          status: 'waiting',
          product_id: 1,
          customer_id: 1,
          quantity: 1,
        },
        {
          name: 'Jane Smith',
          email: 'jane@example.com',
          party_size: 2,
          notification_preference: 'sms',
          source: 'website',
          status: 'waiting',
          product_id: 2,
          customer_id: 2,
          quantity: 1,
        },
        {
          name: 'Bob Wilson',
          email: 'bob@example.com',
          party_size: 6,
          notification_preference: 'both',
          source: 'app',
          status: 'waiting',
          product_id: 3,
          customer_id: 3,
          quantity: 1,
        },
        {
          name: 'Alice Brown',
          email: 'alice@example.com',
          party_size: 3,
          notification_preference: 'email',
          source: 'social_media',
          status: 'waiting',
          product_id: 4,
          customer_id: 4,
          quantity: 1,
        },
      ]

      // Create the waitlist products
      await bulkStore(requests)

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

    it('should handle both populated and empty waitlist products', async () => {
      // First test with data
      const requests = [
        {
          name: 'John Doe',
          email: 'john@example.com',
          party_size: 4,
          notification_preference: 'email',
          source: 'website',
          status: 'waiting',
          product_id: 1,
          customer_id: 1,
          quantity: 1,
        },
        {
          name: 'Jane Smith',
          email: 'jane@example.com',
          party_size: 2,
          notification_preference: 'sms',
          source: 'website',
          status: 'waiting',
          product_id: 2,
          customer_id: 2,
          quantity: 1,
        },
      ]

      // Create the waitlist products
      await bulkStore(requests)

      // Verify with data
      const sourceCounts = await fetchCountBySource()
      expect(sourceCounts).toBeDefined()
      expect(Object.keys(sourceCounts).length).toBe(1) // Only 'website' source
      expect(sourceCounts.website).toBe(2)

      // Now clear the database and test empty case
      await refreshDatabase()
      const emptySourceCounts = await fetchCountBySource()
      expect(emptySourceCounts).toBeDefined()
      expect(Object.keys(emptySourceCounts).length).toBe(0)
    })

    it('should fetch count of waitlist products for a specific date', async () => {
      // Create a specific date for testing that matches our test data
      const testDate = new Date()

      // Create test waitlist products with explicit dates
      const requests = [
        {
          name: 'John Doe',
          email: 'john@example.com',
          party_size: 4,
          notification_preference: 'email',
          source: 'website',
          status: 'waiting',
          product_id: 1,
          customer_id: 1,
          quantity: 1,
        },
        {
          name: 'Jane Smith',
          email: 'jane@example.com',
          party_size: 2,
          notification_preference: 'sms',
          source: 'website',
          status: 'waiting',
          product_id: 2,
          customer_id: 2,
          quantity: 1,
        },
      ]

      // Create the waitlist products
      await bulkStore(requests)

      const count = await fetchCountByDate(testDate)
      expect(count).toBe(2)

      const differentDate = new Date()
      const differentCount = await fetchCountByDate(differentDate)
      expect(differentCount).toBe(2)
    })

    it('should fetch count of waitlist products with specific quantity', async () => {
      // Create test waitlist products with different quantities
      const requests = [
        {
          name: 'John Doe',
          email: 'john@example.com',
          party_size: 4,
          notification_preference: 'email',
          source: 'website',
          status: 'waiting',
          product_id: 1,
          customer_id: 1,
          quantity: 1,
        },
        {
          name: 'Jane Smith',
          email: 'jane@example.com',
          party_size: 4,
          notification_preference: 'sms',
          source: 'website',
          status: 'waiting',
          product_id: 2,
          customer_id: 2,
          quantity: 1,
        },
        {
          name: 'Bob Wilson',
          email: 'bob@example.com',
          party_size: 2,
          notification_preference: 'both',
          source: 'app',
          status: 'waiting',
          product_id: 3,
          customer_id: 3,
          quantity: 1,
        },
      ]

      // Create the waitlist products
      await bulkStore(requests)

      // Test fetching count for party_size = 4
      const countOfFour = await fetchCountByQuantity(4)
      expect(countOfFour).toBe(2)

      // Test fetching count for party_size = 2
      const countOfTwo = await fetchCountByQuantity(2)
      expect(countOfTwo).toBe(1)

      // Test fetching count for non-existent party_size
      const countOfFive = await fetchCountByQuantity(5)
      expect(countOfFive).toBe(0)
    })

    it('should fetch count of waitlist products grouped by quantity', async () => {
      // Create test waitlist products with different quantities
      const requests = [
        {
          name: 'John Doe',
          email: 'john@example.com',
          party_size: 4,
          notification_preference: 'email',
          source: 'website',
          status: 'waiting',
          product_id: 1,
          customer_id: 1,
          quantity: 1,
        },
        {
          name: 'Jane Smith',
          email: 'jane@example.com',
          party_size: 4,
          notification_preference: 'sms',
          source: 'website',
          status: 'waiting',
          product_id: 2,
          customer_id: 2,
          quantity: 1,
        },
        {
          name: 'Bob Wilson',
          email: 'bob@example.com',
          party_size: 2,
          notification_preference: 'both',
          source: 'app',
          status: 'waiting',
          product_id: 3,
          customer_id: 3,
          quantity: 1,
        },
      ]

      // Create the waitlist products
      await bulkStore(requests)

      // Fetch counts by quantity
      const quantityCounts = await fetchCountByAllQuantities()

      // Verify the counts
      expect(quantityCounts).toBeDefined()
      expect(Object.keys(quantityCounts).length).toBe(2) // 2 different quantities

      // Verify each quantity count
      expect(quantityCounts[4]).toBe(2)
      expect(quantityCounts[2]).toBe(1)
    })

    it('should return empty object when no waitlist products exist for quantity grouping', async () => {
      const quantityCounts = await fetchCountByAllQuantities()
      expect(quantityCounts).toBeDefined()
      expect(Object.keys(quantityCounts).length).toBe(0)
    })

    it('should fetch waitlist products between two dates', async () => {
      // Create test dates using today
      const today = new Date()
      const startDate = new Date(today.setHours(0, 0, 0, 0))
      const endDate = new Date(today.setHours(23, 59, 59, 999))

      // Create test waitlist products
      const requests = [
        {
          name: 'John Doe',
          email: 'john@example.com',
          party_size: 4,
          notification_preference: 'email',
          source: 'website',
          status: 'waiting',
          product_id: 1,
          customer_id: 1,
          quantity: 1,
        },
        {
          name: 'Jane Smith',
          email: 'jane@example.com',
          party_size: 2,
          notification_preference: 'sms',
          source: 'website',
          status: 'waiting',
          product_id: 2,
          customer_id: 2,
          quantity: 1,
        },
        {
          name: 'Bob Wilson',
          email: 'bob@example.com',
          party_size: 6,
          notification_preference: 'both',
          source: 'app',
          status: 'waiting',
          product_id: 3,
          quantity: 1,
          customer_id: 3,
        },
      ]

      // Create the waitlist products
      await bulkStore(requests)

      // Fetch waitlists between dates
      const waitlists = await fetchBetweenDates(startDate, endDate)
      expect(waitlists).toBeDefined()
      expect(waitlists.length).toBe(3) // All entries should be within the date range since they're created now
      expect(waitlists.map((w: WaitlistProductJsonResponse) => w.name)).toContain('John Doe')
      expect(waitlists.map((w: WaitlistProductJsonResponse) => w.name)).toContain('Jane Smith')
      expect(waitlists.map((w: WaitlistProductJsonResponse) => w.name)).toContain('Bob Wilson')
    })

    it('should fetch notified waitlist products between two dates', async () => {
      // Create test dates using today
      const today = new Date()
      const startDate = new Date(today.setHours(0, 0, 0, 0))
      const endDate = new Date(today.setHours(23, 59, 59, 999))

      // Create test waitlist products with different notification dates
      const requests = [
        {
          name: 'John Doe',
          email: 'john@example.com',
          party_size: 4,
          notification_preference: 'email',
          source: 'website',
          status: 'notified',
          product_id: 1,
          customer_id: 1,
          notified_at: formatDate(startDate),
          quantity: 1,
        },
        {
          name: 'Jane Smith',
          email: 'jane@example.com',
          party_size: 2,
          notification_preference: 'sms',
          source: 'website',
          status: 'notified',
          product_id: 2,
          customer_id: 2,
          notified_at: formatDate(endDate),
          quantity: 1,
        },
        {
          name: 'Bob Wilson',
          email: 'bob@example.com',
          party_size: 6,
          notification_preference: 'both',
          source: 'app',
          status: 'waiting',
          product_id: 3,
          customer_id: 3,
          quantity: 1,
        },
      ]

      // Create the waitlist products
      await bulkStore(requests as any)

      // Fetch notified waitlists between dates
      const notifiedWaitlists = await fetchNotifiedBetweenDates(startDate, endDate)
      expect(notifiedWaitlists).toBeDefined()
      expect(notifiedWaitlists.length).toBe(2)
      expect(notifiedWaitlists.map((w: WaitlistProductJsonResponse) => w.name)).toContain('John Doe')
      expect(notifiedWaitlists.map((w: WaitlistProductJsonResponse) => w.name)).toContain('Jane Smith')
    })

    it('should fetch purchased waitlist products between two dates', async () => {
      // Create test dates using today
      const today = new Date()
      const startDate = new Date(today.setHours(0, 0, 0, 0))
      const endDate = new Date(today.setHours(23, 59, 59, 999))

      // Create test waitlist products with different purchase dates
      const requests = [
        {
          name: 'John Doe',
          email: 'john@example.com',
          party_size: 4,
          notification_preference: 'email',
          source: 'website',
          status: 'purchased',
          product_id: 1,
          customer_id: 1,
          purchased_at: startDate.getTime(),
          quantity: 1,
        },
        {
          name: 'Jane Smith',
          email: 'jane@example.com',
          party_size: 2,
          notification_preference: 'sms',
          source: 'website',
          status: 'purchased',
          product_id: 2,
          customer_id: 2,
          purchased_at: endDate.getTime(),
          quantity: 1,
        },
        {
          name: 'Bob Wilson',
          email: 'bob@example.com',
          party_size: 6,
          notification_preference: 'both',
          source: 'app',
          status: 'waiting',
          product_id: 3,
          customer_id: 3,
          quantity: 1,
        },
      ]

      // Create the waitlist products
      await bulkStore(requests)

      // Fetch purchased waitlists between dates
      const purchasedWaitlists = await fetchPurchasedBetweenDates(startDate, endDate)
      expect(purchasedWaitlists).toBeDefined()
      expect(purchasedWaitlists.length).toBe(2)
      expect(purchasedWaitlists.map((w: WaitlistProductJsonResponse) => w.name)).toContain('John Doe')
      expect(purchasedWaitlists.map((w: WaitlistProductJsonResponse) => w.name)).toContain('Jane Smith')
    })

    it('should fetch cancelled waitlist products between two dates', async () => {
      // Create test dates using today
      const today = new Date()
      const startDate = new Date(today.setHours(0, 0, 0, 0))
      const endDate = new Date(today.setHours(23, 59, 59, 999))

      // Create test waitlist products with different cancellation dates
      const requests = [
        {
          name: 'John Doe',
          email: 'john@example.com',
          party_size: 4,
          notification_preference: 'email',
          source: 'website',
          status: 'cancelled',
          product_id: 1,
          customer_id: 1,
          cancelled_at: formatDate(startDate),
          quantity: 1,
        },
        {
          name: 'Jane Smith',
          email: 'jane@example.com',
          party_size: 2,
          notification_preference: 'sms',
          source: 'website',
          status: 'cancelled',
          product_id: 2,
          customer_id: 2,
          cancelled_at: formatDate(endDate),
          quantity: 1,
        },
        {
          name: 'Bob Wilson',
          email: 'bob@example.com',
          party_size: 6,
          notification_preference: 'both',
          source: 'app',
          status: 'waiting',
          product_id: 3,
          customer_id: 3,
          quantity: 1,
        },
      ]

      // Create the waitlist products
      await bulkStore(requests as any)

      // Fetch cancelled waitlists between dates
      const cancelledWaitlists = await fetchCancelledBetweenDates(startDate, endDate)
      expect(cancelledWaitlists).toBeDefined()
      expect(cancelledWaitlists.length).toBe(2)
      expect(cancelledWaitlists.map((w: WaitlistProductJsonResponse) => w.name)).toContain('John Doe')
      expect(cancelledWaitlists.map((w: WaitlistProductJsonResponse) => w.name)).toContain('Jane Smith')
    })

    it('should fetch all waitlist products with waiting status', async () => {
      // Create test waitlist products with different statuses
      const requests = [
        {
          name: 'John Doe',
          email: 'john@example.com',
          party_size: 4,
          notification_preference: 'email',
          source: 'website',
          status: 'waiting',
          product_id: 1,
          customer_id: 1,
          quantity: 1,
        },
        {
          name: 'Jane Smith',
          email: 'jane@example.com',
          party_size: 2,
          notification_preference: 'sms',
          source: 'website',
          status: 'waiting',
          product_id: 2,
          customer_id: 2,
          quantity: 1,
        },
        {
          name: 'Bob Wilson',
          email: 'bob@example.com',
          party_size: 6,
          notification_preference: 'both',
          source: 'app',
          status: 'notified',
          product_id: 3,
          customer_id: 3,
          quantity: 1,
        },
        {
          name: 'Alice Brown',
          email: 'alice@example.com',
          party_size: 3,
          notification_preference: 'email',
          source: 'social_media',
          status: 'purchased',
          product_id: 4,
          customer_id: 4,
          quantity: 1,
        },
      ]

      // Create the waitlist products
      await bulkStore(requests as any)

      // Fetch waitlists with waiting status
      const waitingWaitlists = await fetchWaiting()
      expect(waitingWaitlists).toBeDefined()
      expect(waitingWaitlists.length).toBe(2)
      expect(waitingWaitlists.map((w: WaitlistProductJsonResponse) => w.name)).toContain('John Doe')
      expect(waitingWaitlists.map((w: WaitlistProductJsonResponse) => w.name)).toContain('Jane Smith')
    })

    it('should fetch conversion rates for waitlist products', async () => {
      // Create test waitlist products with different statuses
      const requests = [
        {
          name: 'John Doe',
          email: 'john@example.com',
          party_size: 4,
          notification_preference: 'email',
          source: 'website',
          status: 'waiting',
          product_id: 1,
          customer_id: 1,
          quantity: 1,
        },
        {
          name: 'Jane Smith',
          email: 'jane@example.com',
          party_size: 2,
          notification_preference: 'sms',
          source: 'website',
          status: 'purchased',
          product_id: 2,
          customer_id: 2,
          quantity: 1,
        },
        {
          name: 'Bob Wilson',
          email: 'bob@example.com',
          party_size: 6,
          notification_preference: 'both',
          source: 'app',
          status: 'cancelled',
          product_id: 3,
          customer_id: 3,
          quantity: 1,
        },
      ]

      // Create the waitlist products
      await bulkStore(requests as any)

      // Fetch conversion rates
      const rates = await fetchConversionRates()

      // Verify the results
      expect(rates).toBeDefined()
      expect(rates.totalConversionRate).toBeCloseTo(33.33, 2) // 1 purchased out of 3 total
      expect(rates.statusBreakdown).toBeDefined()
      expect(Object.keys(rates.statusBreakdown).length).toBe(3) // waiting, purchased, cancelled

      // Verify each status breakdown
      expect(rates.statusBreakdown.waiting).toEqual({ count: 1, percentage: expect.closeTo(33.33, 2) })
      expect(rates.statusBreakdown.purchased).toEqual({ count: 1, percentage: expect.closeTo(33.33, 2) })
      expect(rates.statusBreakdown.cancelled).toEqual({ count: 1, percentage: expect.closeTo(33.33, 2) })
    })
  })
})
