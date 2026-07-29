type ReceiptJsonResponse = ModelRow<typeof Receipt>
import { beforeEach, describe, expect, it } from 'bun:test'
import { refreshDatabase } from './setup'
import { bulkDestroy, destroy } from '../receipts/destroy'
import {
  fetchAll,
  fetchPageStats,
  fetchPrintJobStats,
  fetchPrintsPerHour,
  fetchPrintTimeStats,
  fetchSuccessRate,
} from '../receipts/fetch'
import { bulkStore, store } from '../receipts/store'
import { update, updatePrintJob, updateStatus } from '../receipts/update'

beforeEach(async () => {
  await refreshDatabase()
})

describe('Print Log Module', () => {
  describe('store', () => {
    it('should return 0 when trying to bulk store an empty array', async () => {
      const count = await bulkStore([])
      expect(count).toBe(0)
    })

    it('returns and updates the persisted row without dialect-specific returning support', async () => {
      const receipt = await store({
        printer: 'Front Counter',
        document: 'Receipt #100',
        timestamp: Date.parse('2026-01-10T12:00:00Z'),
        status: 'success',
        size: 12,
        pages: 1,
        duration: 2,
      })

      expect(receipt.document).toBe('Receipt #100')
      expect(String(receipt.timestamp)).toBe('2026-01-10 12:00:00')

      const warned = await updateStatus(Number(receipt.id), 'warning')
      expect(warned.status).toBe('warning')

      const measured = await updatePrintJob(Number(receipt.id), 14, 2, 3)
      expect(Number(measured.size)).toBe(14)
      expect(Number(measured.pages)).toBe(2)
      expect(Number(measured.duration)).toBe(3)

      const retimed = await update(Number(receipt.id), {
        timestamp: Date.parse('2026-01-10T12:30:00Z') / 1000,
      })
      expect(String(retimed.timestamp)).toBe('2026-01-10 12:30:00')
      expect(await destroy(Number(receipt.id))).toBe(true)

      const unixReceipt = await store({
        printer: 'Back Office',
        document: 'Receipt #101',
        timestamp: Date.parse('2026-01-10T13:00:00Z') / 1000,
        status: 'success',
        size: 6,
        pages: 1,
        duration: 1,
      })

      expect(String(unixReceipt.timestamp)).toBe('2026-01-10 13:00:00')
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

    it('calculates native status, page, and duration statistics from SQL timestamps', async () => {
      const start = Date.parse('2026-01-10T00:00:00Z')
      const end = Date.parse('2026-01-10T23:59:59Z')
      await bulkStore([
        { printer: 'A', document: 'One', timestamp: start + 3600000, status: 'success', size: 10, pages: 1, duration: 10 },
        { printer: 'A', document: 'Two', timestamp: start + 7200000, status: 'warning', size: 20, pages: 2, duration: 20 },
        { printer: 'B', document: 'Three', timestamp: start + 10800000, status: 'failed', size: 30, pages: 5, duration: 30 },
      ])

      expect(await fetchPrintJobStats(start, end)).toEqual({
        total: 3,
        success: 1,
        failed: 1,
        warning: 1,
        averageSize: 20,
        averagePages: 3,
        averageDuration: 20,
      })
      expect(await fetchSuccessRate(start, end)).toEqual({
        successRate: 33,
        total: 3,
        success: 1,
        failed: 1,
        warning: 1,
      })
      expect(await fetchPageStats(start, end)).toEqual({
        totalPages: 8,
        averagePagesPerReceipt: 3,
        totalReceipts: 3,
      })
      expect(await fetchPrintTimeStats(start, end)).toEqual({
        averageDuration: 20,
        minDuration: 10,
        maxDuration: 30,
        totalJobs: 3,
      })
    })
  })
})
