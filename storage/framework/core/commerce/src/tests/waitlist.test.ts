type WaitlistProductJsonResponse = ModelRow<typeof WaitlistProduct>
import { beforeEach, describe, expect, it } from 'bun:test'
import { formatDate } from '@stacksjs/orm'
import { refreshDatabase } from '@stacksjs/testing'
import { bulkDestroy } from '../waitlists/products/destroy'
import {
  fetchBetweenDates,
  fetchCancelledBetweenDates,
  fetchNotifiedBetweenDates,
  fetchPurchasedBetweenDates,
  fetchWaiting,
} from '../waitlists/products/fetch'
import { bulkStore } from '../waitlists/products/store'

beforeEach(async () => {
  await refreshDatabase()
})

describe('Waitlist Product Module', () => {
  describe('store', () => {
    it('should return 0 when trying to bulk store an empty array', async () => {
      const count = await bulkStore([])
      expect(count).toBe(0)
    })
  })

  describe('destroy', () => {
    it('should return 0 when trying to delete an empty array of waitlist products', async () => {
      // Try to delete with an empty array
      const deletedCount = await bulkDestroy([])
      expect(deletedCount).toBe(0)
    })
  })

  describe('fetch', () => {
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
          quantity: 4,
          notification_preference: 'email',
          source: 'website',
          status: 'waiting',
          product_id: 1,
          customer_id: 1,
        },
        {
          name: 'Jane Smith',
          email: 'jane@example.com',
          quantity: 2,
          notification_preference: 'sms',
          source: 'website',
          status: 'waiting',
          product_id: 2,
          customer_id: 2,
        },
        {
          name: 'Bob Wilson',
          email: 'bob@example.com',
          quantity: 6,
          notification_preference: 'both',
          source: 'app',
          status: 'waiting',
          product_id: 3,
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
          quantity: 4,
          notification_preference: 'email',
          source: 'website',
          status: 'notified',
          product_id: 1,
          customer_id: 1,
          notified_at: formatDate(startDate),
        },
        {
          name: 'Jane Smith',
          email: 'jane@example.com',
          quantity: 2,
          notification_preference: 'sms',
          source: 'website',
          status: 'notified',
          product_id: 2,
          customer_id: 2,
          notified_at: formatDate(endDate),
        },
        {
          name: 'Bob Wilson',
          email: 'bob@example.com',
          quantity: 6,
          notification_preference: 'both',
          source: 'app',
          status: 'waiting',
          product_id: 3,
          customer_id: 3,
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
          quantity: 4,
          notification_preference: 'email',
          source: 'website',
          status: 'purchased',
          product_id: 1,
          customer_id: 1,
          purchased_at: startDate.getTime(),
        },
        {
          name: 'Jane Smith',
          email: 'jane@example.com',
          quantity: 2,
          notification_preference: 'sms',
          source: 'website',
          status: 'purchased',
          product_id: 2,
          customer_id: 2,
          purchased_at: endDate.getTime(),
        },
        {
          name: 'Bob Wilson',
          email: 'bob@example.com',
          quantity: 6,
          notification_preference: 'both',
          source: 'app',
          status: 'waiting',
          product_id: 3,
          customer_id: 3,
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
          quantity: 4,
          notification_preference: 'email',
          source: 'website',
          status: 'cancelled',
          product_id: 1,
          customer_id: 1,
          cancelled_at: formatDate(startDate),
        },
        {
          name: 'Jane Smith',
          email: 'jane@example.com',
          quantity: 2,
          notification_preference: 'sms',
          source: 'website',
          status: 'cancelled',
          product_id: 2,
          customer_id: 2,
          cancelled_at: formatDate(endDate),
        },
        {
          name: 'Bob Wilson',
          email: 'bob@example.com',
          quantity: 6,
          notification_preference: 'both',
          source: 'app',
          status: 'waiting',
          product_id: 3,
          customer_id: 3,
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
          quantity: 4,
          notification_preference: 'email',
          source: 'website',
          status: 'waiting',
          product_id: 1,
          customer_id: 1,
        },
        {
          name: 'Jane Smith',
          email: 'jane@example.com',
          quantity: 2,
          notification_preference: 'sms',
          source: 'website',
          status: 'waiting',
          product_id: 2,
          customer_id: 2,
        },
        {
          name: 'Bob Wilson',
          email: 'bob@example.com',
          quantity: 6,
          notification_preference: 'both',
          source: 'app',
          status: 'notified',
          product_id: 3,
          customer_id: 3,
        },
        {
          name: 'Alice Brown',
          email: 'alice@example.com',
          quantity: 3,
          notification_preference: 'email',
          source: 'social_media',
          status: 'purchased',
          product_id: 4,
          customer_id: 4,
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
  })
})
