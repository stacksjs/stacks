type ReceiptJsonResponse = ModelRow<typeof Receipt>
import { beforeEach, describe, expect, it } from 'bun:test'
import { refreshDatabase } from '@stacksjs/testing'
import { bulkDestroy } from '../receipts/destroy'
import { fetchAll, fetchPrintsPerHour } from '../receipts/fetch'
import { bulkStore } from '../receipts/store'

beforeEach(async () => {
  await refreshDatabase()
})

describe('Print Log Module', () => {
  describe('store', () => {
    it('should return 0 when trying to bulk store an empty array', async () => {
      const count = await bulkStore([])
      expect(count).toBe(0)
    })
  })

  describe('destroy', () => {
    it('should return 0 when trying to delete an empty array of print logs', async () => {
      // Try to delete with an empty array
      const deletedCount = await bulkDestroy([])
      expect(deletedCount).toBe(0)
    })
  })

  describe('fetch', () => {
    it('should fetch all print logs', async () => {
      // Create test print logs
      const requests = [
        {
          printer: 'HP LaserJet',
          document: 'invoice.pdf',
          timestamp: Date.now(),
          status: 'success',
          size: 1024,
          pages: 5,
          duration: 30,
          uuid: '1234567890',
          print_device_id: 1,
        },
        {
          printer: 'Epson Printer',
          document: 'report.pdf',
          timestamp: Date.now(),
          status: 'warning',
          size: 2048,
          pages: 10,
          duration: 45,
          uuid: '1234567890',
          print_device_id: 1,
        },
        {
          printer: 'Canon Printer',
          document: 'document.pdf',
          timestamp: Date.now(),
          status: 'failed',
          size: 512,
          pages: 2,
          duration: 15,
          uuid: '1234567890',
          print_device_id: 1,
        },
      ]

      // Create the print logs
      await bulkStore(requests)

      // Fetch all print logs
      const allReceipts = await fetchAll()
      expect(allReceipts).toBeDefined()
      expect(allReceipts.length).toBe(3)
      expect(allReceipts.map((p: ReceiptJsonResponse) => p.printer)).toContain('HP LaserJet')
      expect(allReceipts.map((p: ReceiptJsonResponse) => p.printer)).toContain('Epson Printer')
      expect(allReceipts.map((p: ReceiptJsonResponse) => p.printer)).toContain('Canon Printer')
    })

    it('should calculate prints per hour statistics within a date range', async () => {
      // Use a fixed timestamp for today at midnight
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const startDate = today.getTime()
      const endDate = startDate + 86399999 // End of today

      // Create test receipts with different timestamps
      const requests = [
        {
          printer: 'HP LaserJet',
          document: 'invoice.pdf',
          timestamp: startDate + (2 * 3600000), // 2 AM
          status: 'success',
          size: 1024,
          pages: 5,
          duration: 30,
          uuid: '1234567890',
          print_device_id: 1,
        },
        {
          printer: 'Epson Printer',
          document: 'report.pdf',
          timestamp: startDate + (2 * 3600000), // 2 AM
          status: 'success',
          size: 2048,
          pages: 10,
          duration: 45,
          uuid: '1234567890',
          print_device_id: 1,
        },
        {
          printer: 'Canon Printer',
          document: 'document.pdf',
          timestamp: startDate + (14 * 3600000), // 2 PM
          status: 'warning',
          size: 512,
          pages: 2,
          duration: 15,
          uuid: '1234567890',
          print_device_id: 1,
        },
        {
          printer: 'Brother Printer',
          document: 'error.pdf',
          timestamp: startDate + (14 * 3600000), // 2 PM
          status: 'failed',
          size: 256,
          pages: 1,
          duration: 5,
          uuid: '1234567890',
          print_device_id: 1,
        },
      ]

      await bulkStore(requests)

      // Fetch prints per hour statistics
      const stats = await fetchPrintsPerHour(startDate, endDate)

      // Verify the statistics
      expect(stats).toBeDefined()
      expect(stats.totalPrints).toBe(4)
      expect(stats.totalHours).toBe(24)

      // Verify hourly breakdown
      expect(stats.hourlyBreakdown).toHaveLength(24)
      expect(stats.hourlyBreakdown[2].count).toBe(2) // 2 prints at 2 AM
      expect(stats.hourlyBreakdown[14].count).toBe(2) // 2 prints at 2 PM
      // All other hours should have 0 prints
      stats.hourlyBreakdown.forEach((hour: { hour: number, count: number }, index: number) => {
        if (index !== 2 && index !== 14) {
          expect(hour.count).toBe(0)
        }
      })
    })

    it('should return zero statistics when no receipts exist in date range', async () => {
      const now = Date.now()
      const startDate = now - (now % 86400000) // Start of today
      const endDate = startDate + 86399999 // End of today

      const stats = await fetchPrintsPerHour(startDate, endDate)

      expect(stats).toBeDefined()
      expect(stats.totalPrints).toBe(0)
      expect(stats.totalHours).toBe(24)
      expect(stats.printsPerHour).toBe(0)
      expect(stats.hourlyBreakdown).toHaveLength(24)
      stats.hourlyBreakdown.forEach((hour: { hour: number, count: number }) => {
        expect(hour.count).toBe(0)
      })
    })

    it('should calculate correct statistics for a single hour', async () => {
      const now = Date.now()
      const startDate = now - (now % 86400000) // Start of today
      const endDate = startDate + 3600000 // One hour later

      // Create test receipts all in the same hour
      const requests = [
        {
          printer: 'HP LaserJet',
          document: 'invoice1.pdf',
          timestamp: startDate,
          status: 'success',
          size: 1024,
          pages: 1,
          uuid: '1234567890',
          print_device_id: 1,
          duration: 30,
        },
        {
          printer: 'Epson Printer',
          document: 'invoice2.pdf',
          timestamp: startDate + 1800000, // 30 minutes later
          status: 'success',
          size: 2048,
          pages: 1,
          duration: 45,
          uuid: '1234567890',
          print_device_id: 1,
        },
        {
          printer: 'Canon Printer',
          document: 'invoice3.pdf',
          timestamp: startDate + 3000000, // 50 minutes later
          status: 'success',
          size: 512,
          pages: 1,
          duration: 15,
          uuid: '1234567890',
          print_device_id: 1,
        },
      ]

      await bulkStore(requests)

      const stats = await fetchPrintsPerHour(startDate, endDate)

      expect(stats).toBeDefined()
      expect(stats.totalPrints).toBe(3)
      expect(stats.totalHours).toBe(1)
      expect(stats.printsPerHour).toBe(3) // 3 prints / 1 hour
      expect(stats.hourlyBreakdown).toHaveLength(24)
      // Only the first hour should have prints
      stats.hourlyBreakdown.forEach((hour: { hour: number, count: number }, index: number) => {
        expect(hour.count).toBe(index === 0 ? 3 : 0)
      })
    })

    it('should only count receipts within the specified date range for hourly statistics', async () => {
      const now = Date.now()
      const startDate = now - (now % 86400000) // Start of today
      const endDate = startDate + 86399999 // End of today

      // Create receipts with different dates
      const requests = [
        {
          printer: 'HP LaserJet',
          document: 'invoice.pdf',
          timestamp: startDate,
          status: 'success',
          size: 1024,
          pages: 5,
          duration: 30,
          uuid: '1234567890',
          print_device_id: 1,
        },
        {
          printer: 'Epson Printer',
          document: 'report.pdf',
          timestamp: startDate - 86400000, // Yesterday
          status: 'success',
          size: 2048,
          pages: 10,
          duration: 45,
          uuid: '1234567890',
          print_device_id: 1,
        },
        {
          printer: 'Canon Printer',
          document: 'document.pdf',
          timestamp: endDate + 1, // Tomorrow
          status: 'warning',
          size: 512,
          pages: 2,
          duration: 15,
          uuid: '1234567890',
          print_device_id: 1,
        },
      ]

      await bulkStore(requests)

      const stats = await fetchPrintsPerHour(startDate, endDate)

      // Verify only today's receipt is counted
      expect(stats).toBeDefined()
      expect(stats.totalPrints).toBe(1)
      expect(stats.totalHours).toBe(24)
      expect(stats.hourlyBreakdown).toHaveLength(24)
      // Only the first hour should have prints
      stats.hourlyBreakdown.forEach((hour: { hour: number, count: number }, index: number) => {
        expect(hour.count).toBe(index === 0 ? 1 : 0)
      })
    })
  })
})
