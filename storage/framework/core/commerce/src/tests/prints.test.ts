import type { ReceiptJsonResponse } from '@stacksjs/orm'
import { beforeEach, describe, expect, it } from 'bun:test'
import { refreshDatabase } from '@stacksjs/testing'
import { bulkDestroy, destroy } from '../prints/destroy'
import { fetchAll, fetchById, fetchPrintJobStats, fetchSuccessRate } from '../prints/fetch'
import { bulkStore, store } from '../prints/store'
import { update, updatePrintJob, updateStatus } from '../prints/update'

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

describe('Print Log Module', () => {
  describe('store', () => {
    it('should create a new print log in the database', async () => {
      const requestData = {
        printer: 'HP LaserJet',
        document: 'invoice.pdf',
        timestamp: Date.now(),
        status: 'success',
        size: 1024,
        pages: 5,
        duration: 30,
      }

      const request = new TestRequest(requestData)
      const receipt = await store(request as any)

      expect(receipt).toBeDefined()
      expect(receipt?.printer).toBe('HP LaserJet')
      expect(receipt?.document).toBe('invoice.pdf')
      expect(receipt?.status).toBe('success')
      expect(receipt?.size).toBe(1024)
      expect(receipt?.pages).toBe(5)
      expect(receipt?.duration).toBe(30)
      expect(receipt?.uuid).toBeDefined()

      // Save the ID for further testing
      const receiptId = receipt?.id !== undefined ? Number(receipt.id) : undefined

      // Verify we can fetch the print log we just created
      if (receiptId) {
        const fetchedReceipt = await fetchById(receiptId)
        expect(fetchedReceipt).toBeDefined()
        expect(fetchedReceipt?.id).toBe(receiptId)
      }
    })

    it('should create a print log with minimal required fields', async () => {
      const minimalRequestData = {
        printer: 'Epson Printer',
        document: 'report.pdf',
        timestamp: Date.now(),
        status: 'success',
      }

      const request = new TestRequest(minimalRequestData)
      const receipt = await store(request as any)

      expect(receipt).toBeDefined()
      expect(receipt?.printer).toBe('Epson Printer')
      expect(receipt?.document).toBe('report.pdf')
      expect(receipt?.status).toBe('success')
      expect(receipt?.size).toBeNull()
      expect(receipt?.pages).toBeNull()
      expect(receipt?.duration).toBeNull()
      expect(receipt?.uuid).toBeDefined()
    })

    it('should create multiple print logs with bulk store', async () => {
      const requests = [
        new TestRequest({
          printer: 'HP LaserJet',
          document: 'invoice.pdf',
          timestamp: Date.now(),
          status: 'success',
          size: 1024,
          pages: 5,
          duration: 30,
        }),
        new TestRequest({
          printer: 'Epson Printer',
          document: 'report.pdf',
          timestamp: Date.now(),
          status: 'warning',
          size: 2048,
          pages: 10,
          duration: 45,
        }),
        new TestRequest({
          printer: 'Canon Printer',
          document: 'document.pdf',
          timestamp: Date.now(),
          status: 'failed',
          size: 512,
          pages: 2,
          duration: 15,
        }),
      ]

      const count = await bulkStore(requests as any)
      expect(count).toBe(3)

      // Verify print logs can be fetched
      const allReceipts = await fetchAll()
      expect(allReceipts.length).toBeGreaterThanOrEqual(3)
    })

    it('should return 0 when trying to bulk store an empty array', async () => {
      const count = await bulkStore([])
      expect(count).toBe(0)
    })
  })

  describe('update', () => {
    it('should update an existing print log', async () => {
      // First create a print log to update
      const requestData = {
        printer: 'HP LaserJet',
        document: 'invoice.pdf',
        timestamp: Date.now(),
        status: 'success',
        size: 1024,
        pages: 5,
        duration: 30,
      }

      // Create the print log
      const createRequest = new TestRequest(requestData)
      const receipt = await store(createRequest as any)
      const receiptId = receipt?.id !== undefined ? Number(receipt.id) : undefined

      // Make sure we have a valid print ID before proceeding
      expect(receiptId).toBeDefined()
      if (!receiptId) {
        throw new Error('Failed to create test receipt')
      }

      // Update the print log with new data
      const updateData = {
        printer: 'HP LaserJet Pro',
        document: 'updated_invoice.pdf',
        timestamp: Date.now(),
        status: 'warning',
        size: 2048,
        pages: 10,
        duration: 45,
      }

      const updateRequest = new TestRequest(updateData)
      const updatedReceipt = await update(receiptId, updateRequest as any)

      // Verify the update was successful
      expect(updatedReceipt).toBeDefined()
      expect(updatedReceipt?.id).toBe(receiptId)
      expect(updatedReceipt?.printer).toBe('HP LaserJet Pro')
      expect(updatedReceipt?.document).toBe('updated_invoice.pdf')
      expect(updatedReceipt?.status).toBe('warning')
      expect(updatedReceipt?.size).toBe(2048)
      expect(updatedReceipt?.pages).toBe(10)
      expect(updatedReceipt?.duration).toBe(45)
    })

    it('should update a print log\'s status', async () => {
      // Create a print log
      const requestData = {
        printer: 'HP LaserJet',
        document: 'invoice.pdf',
        timestamp: Date.now(),
        status: 'success',
        size: 1024,
        pages: 5,
        duration: 30,
      }

      const request = new TestRequest(requestData)
      const receipt = await store(request as any)
      const receiptId = receipt?.id !== undefined ? Number(receipt.id) : undefined

      // Make sure we have a valid print ID before proceeding
      expect(receiptId).toBeDefined()
      if (!receiptId) {
        throw new Error('Failed to create test receipt')
      }

      // Update status to warning
      const updatedReceipt = await updateStatus(receiptId, 'warning')
      expect(updatedReceipt).toBeDefined()
      expect(updatedReceipt?.status).toBe('warning')

      // Update status to failed
      const failedReceipt = await updateStatus(receiptId, 'failed')
      expect(failedReceipt).toBeDefined()
      expect(failedReceipt?.status).toBe('failed')
    })

    it('should update print job information', async () => {
      // Create a print log
      const requestData = {
        printer: 'HP LaserJet',
        document: 'invoice.pdf',
        timestamp: Date.now(),
        status: 'success',
        size: 1024,
        pages: 5,
        duration: 30,
      }

      const request = new TestRequest(requestData)
      const receipt = await store(request as any)
      const receiptId = receipt?.id !== undefined ? Number(receipt.id) : undefined

      expect(receiptId).toBeDefined()
      if (!receiptId) {
        throw new Error('Failed to create test receipt')
      }

      // Update print job information
      const updatedReceipt = await updatePrintJob(receiptId, 2048, 10, 45)

      expect(updatedReceipt).toBeDefined()
      expect(updatedReceipt?.size).toBe(2048)
      expect(updatedReceipt?.pages).toBe(10)
      expect(updatedReceipt?.duration).toBe(45)
    })
  })

  describe('destroy', () => {
    it('should delete a print log from the database', async () => {
      // First create a print log to delete
      const requestData = {
        printer: 'HP LaserJet',
        document: 'invoice.pdf',
        timestamp: Date.now(),
        status: 'success',
        size: 1024,
        pages: 5,
        duration: 30,
      }

      // Create the print log
      const request = new TestRequest(requestData)
      const receipt = await store(request as any)
      const receiptId = receipt?.id !== undefined ? Number(receipt.id) : undefined

      // Make sure we have a valid print ID before proceeding
      expect(receiptId).toBeDefined()
      if (!receiptId) {
        throw new Error('Failed to create test receipt')
      }

      // Verify the print log exists
      let fetchedReceipt = await fetchById(receiptId)
      expect(fetchedReceipt).toBeDefined()

      // Delete the print log
      const deleted = await destroy(receiptId)
      expect(deleted).toBe(true)

      // Verify the print log no longer exists
      fetchedReceipt = await fetchById(receiptId)
      expect(fetchedReceipt).toBeUndefined()
    })

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
        new TestRequest({
          printer: 'HP LaserJet',
          document: 'invoice.pdf',
          timestamp: Date.now(),
          status: 'success',
          size: 1024,
          pages: 5,
          duration: 30,
        }),
        new TestRequest({
          printer: 'Epson Printer',
          document: 'report.pdf',
          timestamp: Date.now(),
          status: 'warning',
          size: 2048,
          pages: 10,
          duration: 45,
        }),
        new TestRequest({
          printer: 'Canon Printer',
          document: 'document.pdf',
          timestamp: Date.now(),
          status: 'failed',
          size: 512,
          pages: 2,
          duration: 15,
        }),
      ]

      // Create the print logs
      await bulkStore(requests as any)

      // Fetch all print logs
      const allReceipts = await fetchAll()
      expect(allReceipts).toBeDefined()
      expect(allReceipts.length).toBe(3)
      expect(allReceipts.map((p: ReceiptJsonResponse) => p.printer)).toContain('HP LaserJet')
      expect(allReceipts.map((p: ReceiptJsonResponse) => p.printer)).toContain('Epson Printer')
      expect(allReceipts.map((p: ReceiptJsonResponse) => p.printer)).toContain('Canon Printer')
    })

    it('should fetch a print log by ID', async () => {
      // Create a print log
      const requestData = {
        printer: 'HP LaserJet',
        document: 'invoice.pdf',
        timestamp: Date.now(),
        status: 'success',
        size: 1024,
        pages: 5,
        duration: 30,
      }

      const request = new TestRequest(requestData)
      const receipt = await store(request as any)
      const receiptId = receipt?.id !== undefined ? Number(receipt.id) : undefined

      expect(receiptId).toBeDefined()
      if (!receiptId) {
        throw new Error('Failed to create test receipt')
      }

      // Fetch the print log by ID
      const fetchedReceipt = await fetchById(receiptId)
      expect(fetchedReceipt).toBeDefined()
      expect(fetchedReceipt?.id).toBe(receiptId)
      expect(fetchedReceipt?.printer).toBe('HP LaserJet')
      expect(fetchedReceipt?.document).toBe('invoice.pdf')
      expect(fetchedReceipt?.status).toBe('success')
      expect(fetchedReceipt?.size).toBe(1024)
      expect(fetchedReceipt?.pages).toBe(5)
      expect(fetchedReceipt?.duration).toBe(30)
    })

    it('should fetch print job statistics within a date range', async () => {
      // Create test dates using today
      const now = Date.now()
      const startDate = now - (now % 86400000) // Start of today
      const endDate = startDate + 86399999 // End of today

      // Create test print logs with different statuses and metrics
      const requests = [
        new TestRequest({
          printer: 'HP LaserJet',
          document: 'invoice.pdf',
          timestamp: startDate,
          status: 'success',
          size: 1024,
          pages: 5,
          duration: 30,
        }),
        new TestRequest({
          printer: 'Epson Printer',
          document: 'report.pdf',
          timestamp: startDate,
          status: 'success',
          size: 2048,
          pages: 10,
          duration: 45,
        }),
        new TestRequest({
          printer: 'Canon Printer',
          document: 'document.pdf',
          timestamp: startDate,
          status: 'warning',
          size: 512,
          pages: 2,
          duration: 15,
        }),
        new TestRequest({
          printer: 'Brother Printer',
          document: 'error.pdf',
          timestamp: startDate,
          status: 'failed',
          size: 256,
          pages: 1,
          duration: 5,
        }),
      ]

      // Create the print logs
      await bulkStore(requests as any)

      // Fetch statistics
      const stats = await fetchPrintJobStats(startDate, endDate)

      // Verify the statistics
      expect(stats).toBeDefined()
      expect(stats.total).toBe(4)
      expect(stats.success).toBe(2)
      expect(stats.warning).toBe(1)
      expect(stats.failed).toBe(1)

      // Verify averages (rounded)
      expect(stats.averageSize).toBe(960) // (1024 + 2048 + 512 + 256) / 4
      expect(stats.averagePages).toBe(5) // (5 + 10 + 2 + 1) / 4
      expect(stats.averageDuration).toBe(24) // (30 + 45 + 15 + 5) / 4
    })

    it('should return zero statistics when no print logs exist in date range', async () => {
      const now = Date.now()
      const startDate = now - (now % 86400000) // Start of today
      const endDate = startDate + 86399999 // End of today

      const stats = await fetchPrintJobStats(startDate, endDate)

      expect(stats).toBeDefined()
      expect(stats.total).toBe(0)
      expect(stats.success).toBe(0)
      expect(stats.warning).toBe(0)
      expect(stats.failed).toBe(0)
      expect(stats.averageSize).toBe(0)
      expect(stats.averagePages).toBe(0)
      expect(stats.averageDuration).toBe(0)
    })

    it('should only count print logs within the specified date range', async () => {
      const now = Date.now()
      const startDate = now - (now % 86400000) // Start of today
      const endDate = startDate + 86399999 // End of today

      // Create print logs with different dates
      const requests = [
        new TestRequest({
          printer: 'HP LaserJet',
          document: 'invoice.pdf',
          timestamp: startDate,
          status: 'success',
          size: 1024,
          pages: 5,
          duration: 30,
        }),
        new TestRequest({
          printer: 'Epson Printer',
          document: 'report.pdf',
          timestamp: startDate - 86400000, // Yesterday
          status: 'success',
          size: 2048,
          pages: 10,
          duration: 45,
        }),
        new TestRequest({
          printer: 'Canon Printer',
          document: 'document.pdf',
          timestamp: endDate + 1, // Tomorrow
          status: 'warning',
          size: 512,
          pages: 2,
          duration: 15,
        }),
      ]

      // Create the print logs
      await bulkStore(requests as any)

      // Fetch statistics
      const stats = await fetchPrintJobStats(startDate, endDate)

      // Verify only today's print log is counted
      expect(stats).toBeDefined()
      expect(stats.total).toBe(1)
      expect(stats.success).toBe(1)
      expect(stats.warning).toBe(0)
      expect(stats.failed).toBe(0)
      expect(stats.averageSize).toBe(1024)
      expect(stats.averagePages).toBe(5)
      expect(stats.averageDuration).toBe(30)
    })

    it('should calculate success rate for print jobs within a date range', async () => {
      const now = Date.now()
      const startDate = now - (now % 86400000) // Start of today
      const endDate = startDate + 86399999 // End of today

      // Create test print logs with different statuses
      const requests = [
        new TestRequest({
          printer: 'HP LaserJet',
          document: 'invoice.pdf',
          timestamp: startDate,
          status: 'success',
          size: 1024,
          pages: 5,
          duration: 30,
        }),
        new TestRequest({
          printer: 'Epson Printer',
          document: 'report.pdf',
          timestamp: startDate,
          status: 'success',
          size: 2048,
          pages: 10,
          duration: 45,
        }),
        new TestRequest({
          printer: 'Canon Printer',
          document: 'document.pdf',
          timestamp: startDate,
          status: 'warning',
          size: 512,
          pages: 2,
          duration: 15,
        }),
        new TestRequest({
          printer: 'Brother Printer',
          document: 'error.pdf',
          timestamp: startDate,
          status: 'failed',
          size: 256,
          pages: 1,
          duration: 5,
        }),
      ]

      await bulkStore(requests as any)

      // Fetch success rate
      const stats = await fetchSuccessRate(startDate, endDate)

      // Verify the statistics
      expect(stats).toBeDefined()
      expect(stats.total).toBe(4)
      expect(stats.success).toBe(2)
      expect(stats.warning).toBe(1)
      expect(stats.failed).toBe(1)
      expect(stats.successRate).toBe(50) // 2 out of 4 jobs were successful
    })

    it('should return 0% success rate when no print jobs exist in date range', async () => {
      const now = Date.now()
      const startDate = now - (now % 86400000) // Start of today
      const endDate = startDate + 86399999 // End of today

      const stats = await fetchSuccessRate(startDate, endDate)

      expect(stats).toBeDefined()
      expect(stats.total).toBe(0)
      expect(stats.success).toBe(0)
      expect(stats.warning).toBe(0)
      expect(stats.failed).toBe(0)
      expect(stats.successRate).toBe(0)
    })

    it('should calculate 100% success rate when all jobs are successful', async () => {
      const now = Date.now()
      const startDate = now - (now % 86400000) // Start of today
      const endDate = startDate + 86399999 // End of today

      // Create test print logs with all successful status
      const requests = [
        new TestRequest({
          printer: 'HP LaserJet',
          document: 'invoice.pdf',
          timestamp: startDate,
          status: 'success',
          size: 1024,
          pages: 5,
          duration: 30,
        }),
        new TestRequest({
          printer: 'Epson Printer',
          document: 'report.pdf',
          timestamp: startDate,
          status: 'success',
          size: 2048,
          pages: 10,
          duration: 45,
        }),
        new TestRequest({
          printer: 'Canon Printer',
          document: 'document.pdf',
          timestamp: startDate,
          status: 'success',
          size: 512,
          pages: 2,
          duration: 15,
        }),
      ]

      await bulkStore(requests as any)

      const stats = await fetchSuccessRate(startDate, endDate)

      expect(stats).toBeDefined()
      expect(stats.total).toBe(3)
      expect(stats.success).toBe(3)
      expect(stats.warning).toBe(0)
      expect(stats.failed).toBe(0)
      expect(stats.successRate).toBe(100) // All jobs were successful
    })

    it('should only count print jobs within the specified date range for success rate', async () => {
      const now = Date.now()
      const startDate = now - (now % 86400000) // Start of today
      const endDate = startDate + 86399999 // End of today

      // Create print logs with different dates
      const requests = [
        new TestRequest({
          printer: 'HP LaserJet',
          document: 'invoice.pdf',
          timestamp: startDate,
          status: 'success',
          size: 1024,
          pages: 5,
          duration: 30,
        }),
        new TestRequest({
          printer: 'Epson Printer',
          document: 'report.pdf',
          timestamp: startDate - 86400000, // Yesterday
          status: 'failed',
          size: 2048,
          pages: 10,
          duration: 45,
        }),
        new TestRequest({
          printer: 'Canon Printer',
          document: 'document.pdf',
          timestamp: endDate + 1, // Tomorrow
          status: 'warning',
          size: 512,
          pages: 2,
          duration: 15,
        }),
      ]

      await bulkStore(requests as any)

      const stats = await fetchSuccessRate(startDate, endDate)

      // Verify only today's print log is counted
      expect(stats).toBeDefined()
      expect(stats.total).toBe(1)
      expect(stats.success).toBe(1)
      expect(stats.warning).toBe(0)
      expect(stats.failed).toBe(0)
      expect(stats.successRate).toBe(100) // Only today's job was successful
    })
  })
})
