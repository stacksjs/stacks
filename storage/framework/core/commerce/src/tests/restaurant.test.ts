import type { WaitlistRestaurantJsonResponse } from '@stacksjs/orm'
import { beforeEach, describe, expect, it } from 'bun:test'
import { refreshDatabase } from '@stacksjs/testing'
import { bulkDestroy, destroy } from '../waitlists/restaurant/destroy'
import {
  fetchAll,
  fetchAverageWaitTimes,
  fetchBetweenDates,
  fetchById,
  fetchConversionRates,
  fetchCountByAllPartySizes,
  fetchCountByDate,
  fetchCountByPartySize,
  fetchCountByTablePreference,
  fetchNoShowStats,
  fetchSeatedBetweenDates,
  fetchSeatingRate,
  fetchTablesTurnedToday,
  fetchWaiting,
  fetchWaitingWithPartySizes,
  fetchWaitingWithQuotedTimes,
} from '../waitlists/restaurant/fetch'
import { bulkStore, store } from '../waitlists/restaurant/store'
import { update, updatePartySize, updateQueuePosition, updateStatus, updateWaitTimes } from '../waitlists/restaurant/update'

beforeEach(async () => {
  await refreshDatabase()
})

describe('Restaurant Waitlist Module', () => {
  describe('store', () => {
    it('should create a new restaurant waitlist entry in the database', async () => {
      const requestData = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        party_size: 4,
        check_in_time: Date.now(),
        table_preference: 'indoor',
        status: 'waiting',
        quoted_wait_time: 30,
        actual_wait_time: undefined,
        queue_position: 1,
        customer_id: 1,
      }

      const waitlistEntry = await store(requestData)

      expect(waitlistEntry).toBeDefined()
      expect(waitlistEntry?.name).toBe('John Doe')
      expect(waitlistEntry?.email).toBe('john@example.com')
      expect(waitlistEntry?.phone).toBe('+1234567890')
      expect(waitlistEntry?.party_size).toBe(4)
      expect(waitlistEntry?.check_in_time).toBeDefined()
      expect(waitlistEntry?.table_preference).toBe('indoor')
      expect(waitlistEntry?.status).toBe('waiting')
      expect(waitlistEntry?.quoted_wait_time).toBe(30)
      expect(waitlistEntry?.actual_wait_time).toBeUndefined()
      expect(waitlistEntry?.queue_position).toBe(1)
      expect(waitlistEntry?.customer_id).toBe(1)
      expect(waitlistEntry?.uuid).toBeDefined()

      // Save the ID for further testing
      const waitlistId = waitlistEntry?.id !== undefined ? Number(waitlistEntry.id) : undefined

      // Verify we can fetch the waitlist entry we just created
      if (waitlistId) {
        const fetchedWaitlist = await fetchById(waitlistId)
        expect(fetchedWaitlist).toBeDefined()
        expect(fetchedWaitlist?.id).toBe(waitlistId)
      }
    })

    it('should create a waitlist entry with minimal required fields', async () => {
      const minimalRequestData = {
        name: 'Jane Smith',
        email: 'jane@example.com',
        party_size: 2,
        check_in_time: Date.now(),
        table_preference: 'bar',
        quoted_wait_time: 15,
        customer_id: 1,
        uuid: '1234567890',
        status: 'waiting',
      }

      const waitlistEntry = await store(minimalRequestData)

      expect(waitlistEntry).toBeDefined()
      expect(waitlistEntry?.name).toBe('Jane Smith')
      expect(waitlistEntry?.email).toBe('jane@example.com')
      expect(waitlistEntry?.party_size).toBe(2)
      expect(waitlistEntry?.check_in_time).toBeDefined()
      expect(waitlistEntry?.table_preference).toBe('bar')
      expect(waitlistEntry?.status).toBe('waiting') // Default value
      expect(waitlistEntry?.quoted_wait_time).toBe(15)
      expect(waitlistEntry?.customer_id).toBe(1)
      expect(waitlistEntry?.uuid).toBeDefined()
    })

    it('should create multiple waitlist entries with bulk store', async () => {
      const requests = [
        {
          name: 'John Doe',
          email: 'john@example.com',
          phone: '+1234567890',
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
          phone: '+0987654321',
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

      const count = await bulkStore(requests)
      expect(count).toBe(3)

      // Verify waitlist entries can be fetched
      const allWaitlistEntries = await fetchAll()
      expect(allWaitlistEntries.length).toBeGreaterThanOrEqual(3)
    })

    it('should return 0 when trying to bulk store an empty array', async () => {
      const count = await bulkStore([])
      expect(count).toBe(0)
    })
  })

  describe('update', () => {
    it('should update an existing waitlist entry', async () => {
      // First create a waitlist entry to update
      const requestData = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        party_size: 4,
        check_in_time: Date.now(),
        table_preference: 'indoor',
        status: 'waiting',
        quoted_wait_time: 30,
        customer_id: 1,
      }

      // Create the waitlist entry
      const waitlistEntry = await store(requestData)
      const waitlistId = waitlistEntry?.id !== undefined ? Number(waitlistEntry.id) : undefined

      // Make sure we have a valid waitlist ID before proceeding
      expect(waitlistId).toBeDefined()
      if (!waitlistId) {
        throw new Error('Failed to create test waitlist entry')
      }

      // Update the waitlist entry with new data
      const updateData = {
        name: 'John Doe Jr',
        email: 'john.jr@example.com',
        phone: '+1234567891',
        party_size: 5,
        check_in_time: Date.now(),
        table_preference: 'booth',
        status: 'waiting',
        quoted_wait_time: 45,
        customer_id: 1,
      }

      const updatedWaitlist = await update(waitlistId, updateData)

      // Verify the update was successful
      expect(updatedWaitlist).toBeDefined()
      expect(updatedWaitlist?.id).toBe(waitlistId)
      expect(updatedWaitlist?.name).toBe('John Doe Jr')
      expect(updatedWaitlist?.email).toBe('john.jr@example.com')
      expect(updatedWaitlist?.phone).toBe('+1234567891')
      expect(updatedWaitlist?.party_size).toBe(5)
      expect(updatedWaitlist?.table_preference).toBe('booth')
      expect(updatedWaitlist?.quoted_wait_time).toBe(45)
    })

    it('should update a waitlist entry\'s status', async () => {
      // Create a waitlist entry
      const requestData = {
        name: 'John Doe',
        email: 'john@example.com',
        party_size: 4,
        check_in_time: Date.now(),
        table_preference: 'indoor',
        status: 'waiting',
        quoted_wait_time: 30,
        customer_id: 1,
      }

      const waitlistEntry = await store(requestData)
      const waitlistId = waitlistEntry?.id !== undefined ? Number(waitlistEntry.id) : undefined

      // Make sure we have a valid waitlist ID before proceeding
      expect(waitlistId).toBeDefined()
      if (!waitlistId) {
        throw new Error('Failed to create test waitlist entry')
      }

      // Update status to seated
      const updatedWaitlist = await updateStatus(waitlistId, 'seated')
      expect(updatedWaitlist).toBeDefined()
      expect(updatedWaitlist?.status).toBe('seated')
    })

    it('should update party size', async () => {
      // Create a waitlist entry
      const requestData = {
        name: 'John Doe',
        email: 'john@example.com',
        party_size: 4,
        check_in_time: Date.now(),
        table_preference: 'indoor',
        status: 'waiting',
        quoted_wait_time: 30,
        customer_id: 1,
      }

      const waitlistEntry = await store(requestData)
      const waitlistId = waitlistEntry?.id !== undefined ? Number(waitlistEntry.id) : undefined

      expect(waitlistId).toBeDefined()
      if (!waitlistId) {
        throw new Error('Failed to create test waitlist entry')
      }

      // Update party size
      const updatedWaitlist = await updatePartySize(waitlistId, 6)

      expect(updatedWaitlist).toBeDefined()
      expect(updatedWaitlist?.party_size).toBe(6)
    })

    it('should update wait times', async () => {
      // Create a waitlist entry
      const requestData = {
        name: 'John Doe',
        email: 'john@example.com',
        party_size: 4,
        check_in_time: Date.now(),
        table_preference: 'indoor',
        status: 'waiting',
        quoted_wait_time: 30,
        customer_id: 1,
      }

      const waitlistEntry = await store(requestData)
      const waitlistId = waitlistEntry?.id !== undefined ? Number(waitlistEntry.id) : undefined

      expect(waitlistId).toBeDefined()
      if (!waitlistId) {
        throw new Error('Failed to create test waitlist entry')
      }

      // Update wait times
      const updatedWaitlist = await updateWaitTimes(waitlistId, 45, 60)

      expect(updatedWaitlist).toBeDefined()
      expect(updatedWaitlist?.quoted_wait_time).toBe(45)
      expect(updatedWaitlist?.actual_wait_time).toBe(60)
    })

    it('should update queue position', async () => {
      // Create a waitlist entry
      const requestData = {
        name: 'John Doe',
        email: 'john@example.com',
        party_size: 4,
        check_in_time: Date.now(),
        table_preference: 'indoor',
        status: 'waiting',
        quoted_wait_time: 30,
        customer_id: 1,
      }

      const waitlistEntry = await store(requestData)
      const waitlistId = waitlistEntry?.id !== undefined ? Number(waitlistEntry.id) : undefined

      expect(waitlistId).toBeDefined()
      if (!waitlistId) {
        throw new Error('Failed to create test waitlist entry')
      }

      // Update queue position
      const updatedWaitlist = await updateQueuePosition(waitlistId, 2)

      expect(updatedWaitlist).toBeDefined()
      expect(updatedWaitlist?.queue_position).toBe(2)
    })
  })

  describe('destroy', () => {
    it('should delete a waitlist entry from the database', async () => {
      // First create a waitlist entry to delete
      const requestData = {
        name: 'John Doe',
        email: 'john@example.com',
        party_size: 4,
        check_in_time: Date.now(),
        table_preference: 'indoor',
        status: 'waiting',
        quoted_wait_time: 30,
        customer_id: 1,
      }

      // Create the waitlist entry
      const waitlistEntry = await store(requestData)
      const waitlistId = waitlistEntry?.id !== undefined ? Number(waitlistEntry.id) : undefined

      // Make sure we have a valid waitlist ID before proceeding
      expect(waitlistId).toBeDefined()
      if (!waitlistId) {
        throw new Error('Failed to create test waitlist entry')
      }

      // Verify the waitlist entry exists
      let fetchedWaitlist = await fetchById(waitlistId)
      expect(fetchedWaitlist).toBeDefined()

      // Delete the waitlist entry
      const deletedWaitlist = await destroy(waitlistId)
      expect(deletedWaitlist).toBeDefined()
      expect(deletedWaitlist?.id).toBe(waitlistId)

      // Verify the waitlist entry no longer exists
      fetchedWaitlist = await fetchById(waitlistId)
      expect(fetchedWaitlist).toBeUndefined()
    })

    it('should return 0 when trying to delete an empty array of waitlist entries', async () => {
      // Try to delete with an empty array
      const deletedCount = await bulkDestroy([])
      expect(deletedCount).toBe(0)
    })
  })

  describe('fetch', () => {
    it('should fetch count of waitlist entries grouped by table preference', async () => {
      // Create test waitlist entries with different table preferences
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
          table_preference: 'indoor',
          status: 'waiting',
          quoted_wait_time: 15,
          customer_id: 2,
        },
        {
          name: 'Bob Wilson',
          email: 'bob@example.com',
          party_size: 6,
          check_in_time: Date.now(),
          table_preference: 'bar',
          status: 'waiting',
          quoted_wait_time: 45,
          customer_id: 3,
        },
        {
          name: 'Alice Brown',
          email: 'alice@example.com',
          party_size: 3,
          check_in_time: Date.now(),
          table_preference: 'booth',
          status: 'waiting',
          quoted_wait_time: 20,
          customer_id: 4,
        },
      ]

      // Create the waitlist entries
      await bulkStore(requests)

      // Fetch the counts by table preference
      const preferenceCounts = await fetchCountByTablePreference()

      // Verify the counts
      expect(preferenceCounts).toBeDefined()
      expect(Object.keys(preferenceCounts).length).toBe(3) // indoor, bar, booth

      // Verify each preference count
      expect(preferenceCounts.indoor).toBe(2)
      expect(preferenceCounts.bar).toBe(1)
      expect(preferenceCounts.booth).toBe(1)
    })

    it('should fetch count of waitlist entries for a specific date', async () => {
      // Create a specific date for testing that matches our test data
      const testDate = new Date()

      // Create test waitlist entries with explicit dates
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
      ]

      // Create the waitlist entries
      await bulkStore(requests)

      const count = await fetchCountByDate(testDate)
      expect(count).toBe(2)

      const differentDate = new Date()
      const differentCount = await fetchCountByDate(differentDate)
      expect(differentCount).toBe(2)
    })

    it('should fetch count of waitlist entries with specific party size', async () => {
      // Create test waitlist entries with different party sizes
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
      ]

      // Create the waitlist entries
      await bulkStore(requests)

      // Test fetching count for party_size = 4
      const countOfFour = await fetchCountByPartySize(4)
      expect(countOfFour).toBe(2)

      // Test fetching count for party_size = 2
      const countOfTwo = await fetchCountByPartySize(2)
      expect(countOfTwo).toBe(1)

      // Test fetching count for non-existent party_size
      const countOfFive = await fetchCountByPartySize(5)
      expect(countOfFive).toBe(0)
    })

    it('should fetch count of waitlist entries grouped by party size', async () => {
      // Create test waitlist entries with different party sizes
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
      ]

      // Create the waitlist entries
      await bulkStore(requests)

      // Fetch counts by party size
      const sizeCounts = await fetchCountByAllPartySizes()

      // Verify the counts
      expect(sizeCounts).toBeDefined()
      expect(Object.keys(sizeCounts).length).toBe(2) // 2 different party sizes

      // Verify each party size count
      expect(sizeCounts[4]).toBe(2)
      expect(sizeCounts[2]).toBe(1)
    })

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

    it('should fetch conversion rates for waitlist entries', async () => {
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

      // Fetch conversion rates
      const rates = await fetchConversionRates()

      // Verify the results
      expect(rates).toBeDefined()
      expect(rates.totalConversionRate).toBeCloseTo(33.33, 2) // 1 seated out of 3 total
      expect(rates.statusBreakdown).toBeDefined()
      expect(Object.keys(rates.statusBreakdown).length).toBe(2) // waiting, seated

      // Verify each status breakdown
      expect(rates.statusBreakdown.waiting).toEqual({ count: 2, percentage: expect.closeTo(66.67, 2) })
      expect(rates.statusBreakdown.seated).toEqual({ count: 1, percentage: expect.closeTo(33.33, 2) })
    })

    it('should fetch average wait times for waitlist entries', async () => {
      // Create test waitlist entries with different wait times
      const requests = [
        {
          name: 'John Doe',
          email: 'john@example.com',
          party_size: 4,
          check_in_time: Date.now(),
          table_preference: 'indoor',
          status: 'seated',
          quoted_wait_time: 30,
          actual_wait_time: 35,
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
          actual_wait_time: 20,
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

      // Fetch average wait times
      const waitTimes = await fetchAverageWaitTimes()

      // Verify the results
      expect(waitTimes).toBeDefined()
      expect(waitTimes.averageQuotedWaitTime).toBe(30) // (30 + 15 + 45) / 3
      expect(waitTimes.averageActualWaitTime).toBe(27.5) // (35 + 20) / 2
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

    it('should fetch seating rate statistics', async () => {
      // Create test dates
      const today = new Date()
      const startDate = new Date(today)
      startDate.setHours(0, 0, 0, 0)
      const endDate = new Date(today)
      endDate.setHours(23, 59, 59, 999)

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
        {
          name: 'Charlie Davis',
          email: 'charlie@example.com',
          party_size: 5,
          check_in_time: Date.now(),
          table_preference: 'bar',
          status: 'cancelled',
          quoted_wait_time: 30,
          customer_id: 5,
        },
      ]

      // Create the waitlist entries
      await bulkStore(requests)

      // Fetch seating rate statistics
      const stats = await fetchSeatingRate(startDate, endDate)

      // Verify the results
      expect(stats).toBeDefined()
      expect(stats.totalEntries).toBe(5)
      expect(stats.seatedEntries).toBe(2)
      expect(stats.seatingRate).toBe(40) // 2 seated out of 5 total = 40%

      // Verify status breakdown
      expect(stats.statusBreakdown).toBeDefined()
      expect(Object.keys(stats.statusBreakdown).length).toBe(3) // seated, waiting, cancelled

      // Verify each status breakdown
      expect(stats.statusBreakdown.seated).toEqual({ count: 2, percentage: 40 })
      expect(stats.statusBreakdown.waiting).toEqual({ count: 2, percentage: 40 })
      expect(stats.statusBreakdown.cancelled).toEqual({ count: 1, percentage: 20 })
    })

    it('should handle empty waitlist for seating rate', async () => {
      // Create test dates
      const today = new Date()
      const startDate = new Date(today)
      startDate.setHours(0, 0, 0, 0)
      const endDate = new Date(today)
      endDate.setHours(23, 59, 59, 999)

      // Fetch seating rate statistics with no entries
      const stats = await fetchSeatingRate(startDate, endDate)

      // Verify the results
      expect(stats).toBeDefined()
      expect(stats.totalEntries).toBe(0)
      expect(stats.seatedEntries).toBe(0)
      expect(stats.seatingRate).toBe(0)
      expect(stats.statusBreakdown).toEqual({})
    })

    it('should fetch no-show statistics', async () => {
      // Create test dates
      const today = new Date()
      const startDate = new Date(today)
      startDate.setHours(0, 0, 0, 0)
      const endDate = new Date(today)
      endDate.setHours(23, 59, 59, 999)

      // Create test waitlist entries with different statuses
      const requests = [
        {
          name: 'John Doe',
          email: 'john@example.com',
          party_size: 4,
          check_in_time: Date.now(),
          table_preference: 'indoor',
          status: 'no_show',
          quoted_wait_time: 30,
          customer_id: 1,
        },
        {
          name: 'Jane Smith',
          email: 'jane@example.com',
          party_size: 2,
          check_in_time: Date.now(),
          table_preference: 'bar',
          status: 'no_show',
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
        {
          name: 'Alice Brown',
          email: 'alice@example.com',
          party_size: 3,
          check_in_time: Date.now(),
          table_preference: 'indoor',
          status: 'seated',
          quoted_wait_time: 20,
          customer_id: 4,
        },
      ]

      // Create the waitlist entries
      await bulkStore(requests)

      // Fetch no-show statistics
      const stats = await fetchNoShowStats(startDate, endDate)

      // Verify the results
      expect(stats).toBeDefined()
      expect(stats.totalNoShows).toBe(2)
      expect(stats.noShowRate).toBe(50) // 2 no-shows out of 4 total = 50%
      expect(stats.averageQuotedWaitTime).toBe(22.5) // (30 + 15) / 2
      expect(stats.averagePartySize).toBe(3) // (4 + 2) / 2

      // Verify table preference breakdown
      expect(stats.breakdownByTablePreference).toBeDefined()
      expect(Object.keys(stats.breakdownByTablePreference).length).toBe(2) // indoor, bar
      expect(stats.breakdownByTablePreference.indoor).toBe(1)
      expect(stats.breakdownByTablePreference.bar).toBe(1)

      // Verify party size breakdown
      expect(stats.breakdownByPartySize).toBeDefined()
      expect(Object.keys(stats.breakdownByPartySize).length).toBe(2) // 2, 4
      expect(stats.breakdownByPartySize[2]).toBe(1)
      expect(stats.breakdownByPartySize[4]).toBe(1)
    })

    it('should handle empty no-show list', async () => {
      // Create test dates
      const today = new Date()
      const startDate = new Date(today)
      startDate.setHours(0, 0, 0, 0)
      const endDate = new Date(today)
      endDate.setHours(23, 59, 59, 999)

      // Create test entries with no no-shows
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
          status: 'waiting',
          quoted_wait_time: 15,
          customer_id: 2,
        },
      ]

      // Create the waitlist entries
      await bulkStore(requests)

      // Fetch no-show statistics
      const stats = await fetchNoShowStats(startDate, endDate)

      // Verify the results
      expect(stats).toBeDefined()
      expect(stats.totalNoShows).toBe(0)
      expect(stats.noShowRate).toBe(0)
      expect(stats.averageQuotedWaitTime).toBe(0)
      expect(stats.averagePartySize).toBe(0)
      expect(stats.breakdownByTablePreference).toEqual({})
      expect(stats.breakdownByPartySize).toEqual({})
    })
  })
})
