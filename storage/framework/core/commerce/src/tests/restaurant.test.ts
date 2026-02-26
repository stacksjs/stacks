type WaitlistRestaurantJsonResponse = ModelRow<typeof WaitlistRestaurant>
import { beforeEach, describe, expect, it } from 'bun:test'
import { refreshDatabase } from '@stacksjs/testing'
import { bulkDestroy } from '../waitlists/restaurant/destroy'
import {
  fetchBetweenDates,
  fetchSeatedBetweenDates,
  fetchTablesTurnedToday,
  fetchWaiting,
  fetchWaitingWithPartySizes,
  fetchWaitingWithQuotedTimes,
} from '../waitlists/restaurant/fetch'
import { bulkStore } from '../waitlists/restaurant/store'

beforeEach(async () => {
  await refreshDatabase()
})

describe('Restaurant Waitlist Module', () => {
  describe('store', () => {
    it('should return 0 when trying to bulk store an empty array', async () => {
      const count = await bulkStore([])
      expect(count).toBe(0)
    })
  })

  describe('destroy', () => {
    it('should return 0 when trying to delete an empty array of waitlist entries', async () => {
      // Try to delete with an empty array
      const deletedCount = await bulkDestroy([])
      expect(deletedCount).toBe(0)
    })
  })

  describe('fetch', () => {
    it('should fetch waitlist entries between two dates', async () => {
      // Create test dates using today
      const today = new Date()
      const startDate = new Date(today.setHours(0, 0, 0, 0))
      const endDate = new Date(today.setHours(23, 59, 59, 999))

      // Create test waitlist entries
      const requests = [
        {
          name: 'John Doe',
          email: 'john@example.com',
          party_size: 4,
          check_in_time: Date.now(),
          table_preference: 'indoor',
          status: 'waiting',
          quoted_wait_time: 30,
          customer_id: 1,
        },
        {
          name: 'Jane Smith',
          email: 'jane@example.com',
          party_size: 2,
          check_in_time: Date.now(),
          table_preference: 'bar',
          status: 'waiting',
          quoted_wait_time: 15,
          customer_id: 2,
        },
        {
          name: 'Bob Wilson',
          email: 'bob@example.com',
          party_size: 6,
          check_in_time: Date.now(),
          table_preference: 'booth',
          status: 'waiting',
          quoted_wait_time: 45,
          customer_id: 3,
        },
      ]

      // Create the waitlist entries
      await bulkStore(requests)

      // Fetch entries between dates
      const entries = await fetchBetweenDates(startDate, endDate)
      expect(entries).toBeDefined()
      expect(entries.length).toBe(3) // All entries should be within the date range
      expect(entries.map((w: WaitlistRestaurantJsonResponse) => w.name)).toContain('John Doe')
      expect(entries.map((w: WaitlistRestaurantJsonResponse) => w.name)).toContain('Jane Smith')
      expect(entries.map((w: WaitlistRestaurantJsonResponse) => w.name)).toContain('Bob Wilson')
    })

    it('should fetch seated waitlist entries between two dates', async () => {
      // Create test dates using today
      const today = new Date()
      const startDate = new Date(today.setHours(0, 0, 0, 0))
      const endDate = new Date(today.setHours(23, 59, 59, 999))

      // Create test waitlist entries with different statuses
      const requests = [
        {
          name: 'John Doe',
          email: 'john@example.com',
          party_size: 4,
          check_in_time: Date.now(),
          table_preference: 'indoor',
          status: 'seated',
          quoted_wait_time: 30,
          customer_id: 1,
        },
        {
          name: 'Jane Smith',
          email: 'jane@example.com',
          party_size: 2,
          check_in_time: Date.now(),
          table_preference: 'bar',
          status: 'seated',
          quoted_wait_time: 15,
          customer_id: 2,
        },
        {
          name: 'Bob Wilson',
          email: 'bob@example.com',
          party_size: 6,
          check_in_time: Date.now(),
          table_preference: 'booth',
          status: 'waiting',
          quoted_wait_time: 45,
          customer_id: 3,
        },
      ]

      // Create the waitlist entries
      await bulkStore(requests)

      // Fetch seated entries between dates
      const seatedEntries = await fetchSeatedBetweenDates(startDate, endDate)
      expect(seatedEntries).toBeDefined()
      expect(seatedEntries.length).toBe(2)
      expect(seatedEntries.map((w: WaitlistRestaurantJsonResponse) => w.name)).toContain('John Doe')
      expect(seatedEntries.map((w: WaitlistRestaurantJsonResponse) => w.name)).toContain('Jane Smith')
    })

    it('should fetch all waitlist entries with waiting status', async () => {
      // Create test waitlist entries with different statuses
      const requests = [
        {
          name: 'John Doe',
          email: 'john@example.com',
          party_size: 4,
          check_in_time: Date.now(),
          table_preference: 'indoor',
          status: 'waiting',
          quoted_wait_time: 30,
          customer_id: 1,
        },
        {
          name: 'Jane Smith',
          email: 'jane@example.com',
          party_size: 2,
          check_in_time: Date.now(),
          table_preference: 'bar',
          status: 'waiting',
          quoted_wait_time: 15,
          customer_id: 2,
        },
        {
          name: 'Bob Wilson',
          email: 'bob@example.com',
          party_size: 6,
          check_in_time: Date.now(),
          table_preference: 'booth',
          status: 'seated',
          quoted_wait_time: 45,
          customer_id: 3,
        },
      ]

      // Create the waitlist entries
      await bulkStore(requests)

      // Fetch entries with waiting status
      const waitingEntries = await fetchWaiting()
      expect(waitingEntries).toBeDefined()
      expect(waitingEntries.length).toBe(2)
      expect(waitingEntries.map((w: WaitlistRestaurantJsonResponse) => w.name)).toContain('John Doe')
      expect(waitingEntries.map((w: WaitlistRestaurantJsonResponse) => w.name)).toContain('Jane Smith')
    })

    it('should fetch waiting entries with quoted wait times', async () => {
      // Create test waitlist entries with different wait times and statuses
      const requests = [
        {
          name: 'John Doe',
          email: 'john@example.com',
          party_size: 4,
          check_in_time: Date.now(),
          table_preference: 'indoor',
          status: 'waiting',
          quoted_wait_time: 30,
          customer_id: 1,
        },
        {
          name: 'Jane Smith',
          email: 'jane@example.com',
          party_size: 2,
          check_in_time: Date.now(),
          table_preference: 'bar',
          status: 'waiting',
          quoted_wait_time: 15,
          customer_id: 2,
        },
        {
          name: 'Bob Wilson',
          email: 'bob@example.com',
          party_size: 6,
          check_in_time: Date.now(),
          table_preference: 'booth',
          status: 'seated',
          quoted_wait_time: 45,
          customer_id: 3,
        },
      ]

      // Create the waitlist entries
      await bulkStore(requests)

      // Fetch waiting entries with quoted times
      const result = await fetchWaitingWithQuotedTimes()

      // Verify the results
      expect(result).toBeDefined()
      expect(result.entries).toBeDefined()
      expect(result.entries.length).toBe(2) // Only waiting entries
      expect(result.totalQuotedWaitTime).toBe(45) // 30 + 15
      expect(result.averageQuotedWaitTime).toBe(22.5) // (30 + 15) / 2

      // Verify individual entries
      expect(result.entries.map(e => e.name)).toContain('John Doe')
      expect(result.entries.map(e => e.name)).toContain('Jane Smith')
      expect(result.entries.map(e => e.quoted_wait_time)).toContain(30)
      expect(result.entries.map(e => e.quoted_wait_time)).toContain(15)
    })

    it('should handle empty waiting list for quoted times', async () => {
      // Create only seated entries
      const requests = [
        {
          name: 'John Doe',
          email: 'john@example.com',
          party_size: 4,
          check_in_time: Date.now(),
          table_preference: 'indoor',
          status: 'seated',
          quoted_wait_time: 30,
          customer_id: 1,
        },
        {
          name: 'Jane Smith',
          email: 'jane@example.com',
          party_size: 2,
          check_in_time: Date.now(),
          table_preference: 'bar',
          status: 'seated',
          quoted_wait_time: 15,
          customer_id: 2,
        },
      ]

      // Create the waitlist entries
      await bulkStore(requests)

      // Fetch waiting entries with quoted times
      const result = await fetchWaitingWithQuotedTimes()

      // Verify the results
      expect(result).toBeDefined()
      expect(result.entries).toBeDefined()
      expect(result.entries.length).toBe(0)
      expect(result.totalQuotedWaitTime).toBe(0)
      expect(result.averageQuotedWaitTime).toBe(0)
    })

    it('should fetch waiting entries with party size calculations', async () => {
      // Create test waitlist entries with different party sizes and statuses
      const requests = [
        {
          name: 'John Doe',
          email: 'john@example.com',
          party_size: 4,
          check_in_time: Date.now(),
          table_preference: 'indoor',
          status: 'waiting',
          quoted_wait_time: 30,
          customer_id: 1,
        },
        {
          name: 'Jane Smith',
          email: 'jane@example.com',
          party_size: 4,
          check_in_time: Date.now(),
          table_preference: 'bar',
          status: 'waiting',
          quoted_wait_time: 15,
          customer_id: 2,
        },
        {
          name: 'Bob Wilson',
          email: 'bob@example.com',
          party_size: 2,
          check_in_time: Date.now(),
          table_preference: 'booth',
          status: 'waiting',
          quoted_wait_time: 45,
          customer_id: 3,
        },
        {
          name: 'Alice Brown',
          email: 'alice@example.com',
          party_size: 6,
          check_in_time: Date.now(),
          table_preference: 'indoor',
          status: 'seated',
          quoted_wait_time: 60,
          customer_id: 4,
        },
      ]

      // Create the waitlist entries
      await bulkStore(requests)

      // Fetch waiting entries with party sizes
      const result = await fetchWaitingWithPartySizes()

      // Verify the results
      expect(result).toBeDefined()
      expect(result.entries).toBeDefined()
      expect(result.entries.length).toBe(3) // Only waiting entries
      expect(result.totalPartySize).toBe(10) // 4 + 4 + 2
      expect(result.averagePartySize).toBeCloseTo(3.33, 2) // 10 / 3

      // Verify party size breakdown
      expect(result.partySizeBreakdown).toBeDefined()
      expect(Object.keys(result.partySizeBreakdown).length).toBe(2) // 2 different party sizes
      expect(result.partySizeBreakdown[4]).toBe(2) // Two parties of 4
      expect(result.partySizeBreakdown[2]).toBe(1) // One party of 2

      // Verify individual entries
      expect(result.entries.map(e => e.name)).toContain('John Doe')
      expect(result.entries.map(e => e.name)).toContain('Jane Smith')
      expect(result.entries.map(e => e.name)).toContain('Bob Wilson')
    })

    it('should handle empty waiting list for party sizes', async () => {
      // Create only seated entries
      const requests = [
        {
          name: 'John Doe',
          email: 'john@example.com',
          party_size: 4,
          check_in_time: Date.now(),
          table_preference: 'indoor',
          status: 'seated',
          quoted_wait_time: 30,
          customer_id: 1,
        },
        {
          name: 'Jane Smith',
          email: 'jane@example.com',
          party_size: 2,
          check_in_time: Date.now(),
          table_preference: 'bar',
          status: 'seated',
          quoted_wait_time: 15,
          customer_id: 2,
        },
      ]

      // Create the waitlist entries
      await bulkStore(requests)

      // Fetch waiting entries with party sizes
      const result = await fetchWaitingWithPartySizes()

      // Verify the results
      expect(result).toBeDefined()
      expect(result.entries).toBeDefined()
      expect(result.entries.length).toBe(0)
      expect(result.totalPartySize).toBe(0)
      expect(result.averagePartySize).toBe(0)
      expect(result.partySizeBreakdown).toEqual({})
    })

    it('should fetch tables turned statistics for today', async () => {
      // Create test dates using today
      const today = new Date()
      const startOfDay = new Date(today)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(today)
      endOfDay.setHours(23, 59, 59, 999)

      // Create test waitlist entries with different statuses and table preferences
      const requests = [
        {
          name: 'John Doe',
          email: 'john@example.com',
          party_size: 4,
          check_in_time: startOfDay.getTime(),
          table_preference: 'indoor',
          status: 'seated',
          quoted_wait_time: 30,
          customer_id: 1,
        },
        {
          name: 'Jane Smith',
          email: 'jane@example.com',
          party_size: 2,
          check_in_time: endOfDay.getTime(),
          table_preference: 'bar',
          status: 'seated',
          quoted_wait_time: 15,
          customer_id: 2,
        },
        {
          name: 'Bob Wilson',
          email: 'bob@example.com',
          party_size: 6,
          check_in_time: Date.now(),
          table_preference: 'booth',
          status: 'seated',
          quoted_wait_time: 45,
          customer_id: 3,
        },
        {
          name: 'Alice Brown',
          email: 'alice@example.com',
          party_size: 3,
          check_in_time: Date.now(),
          table_preference: 'indoor',
          status: 'waiting',
          quoted_wait_time: 20,
          customer_id: 4,
        },
      ]

      // Create the waitlist entries
      await bulkStore(requests)

      // Fetch tables turned statistics
      const stats = await fetchTablesTurnedToday()

      // Verify the results
      expect(stats).toBeDefined()
      expect(stats.totalTablesTurned).toBe(3) // 3 seated entries
      expect(stats.totalCustomersSeated).toBe(12) // 4 + 2 + 6
      expect(stats.averagePartySize).toBe(4) // 12 / 3

      // Verify table preference breakdown
      expect(stats.breakdownByTablePreference).toBeDefined()
      expect(Object.keys(stats.breakdownByTablePreference).length).toBe(3) // indoor, bar, booth
      expect(stats.breakdownByTablePreference.indoor).toBe(1)
      expect(stats.breakdownByTablePreference.bar).toBe(1)
      expect(stats.breakdownByTablePreference.booth).toBe(1)

      // Verify party size breakdown
      expect(stats.breakdownByPartySize).toBeDefined()
      expect(Object.keys(stats.breakdownByPartySize).length).toBe(3) // 2, 3, 4, 6
      expect(stats.breakdownByPartySize[2]).toBe(1)
      expect(stats.breakdownByPartySize[4]).toBe(1)
      expect(stats.breakdownByPartySize[6]).toBe(1)
    })

    it('should handle no tables turned today', async () => {
      // Create test entries with different dates
      const today = new Date()
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)

      const requests = [
        {
          name: 'John Doe',
          email: 'john@example.com',
          party_size: 4,
          check_in_time: yesterday.getTime(),
          table_preference: 'indoor',
          status: 'seated',
          quoted_wait_time: 30,
          customer_id: 1,
        },
        {
          name: 'Jane Smith',
          email: 'jane@example.com',
          party_size: 2,
          check_in_time: yesterday.getTime(),
          table_preference: 'bar',
          status: 'seated',
          quoted_wait_time: 15,
          customer_id: 2,
        },
        {
          name: 'Bob Wilson',
          email: 'bob@example.com',
          party_size: 6,
          check_in_time: Date.now(),
          table_preference: 'booth',
          status: 'waiting',
          quoted_wait_time: 45,
          customer_id: 3,
        },
      ]

      // Create the waitlist entries
      await bulkStore(requests)

      // Fetch tables turned statistics
      const stats = await fetchTablesTurnedToday()

      // Verify the results
      expect(stats).toBeDefined()
      expect(stats.totalTablesTurned).toBe(0)
      expect(stats.totalCustomersSeated).toBe(0)
      expect(stats.averagePartySize).toBe(0)
      expect(stats.breakdownByTablePreference).toEqual({})
      expect(stats.breakdownByPartySize).toEqual({})
    })
  })
})
