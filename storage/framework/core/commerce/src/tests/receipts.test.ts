import type { ReceiptJsonResponse } from '@stacksjs/orm'
import { beforeEach, describe, expect, it } from 'bun:test'
import { refreshDatabase } from '@stacksjs/testing'
import { bulkDestroy, destroy } from '../receipts/destroy'
import { fetchAll, fetchById, fetchPageStats, fetchPrintJobStats, fetchPrintsPerHour, fetchPrintTimeStats, fetchSuccessRate } from '../receipts/fetch'
import { bulkStore, store } from '../receipts/store'
import { update, updatePrintJob, updateStatus } from '../receipts/update'

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
        uuid: '1234567890',
        print_device_id: 1,
      }

      const receipt = await store(requestData)

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
        uuid: '1234567890',
        print_device_id: 1,
      }

      const receipt = await store(minimalRequestData)

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

      const count = await bulkStore(requests)
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
        uuid: '1234567890',
        print_device_id: 1,
      }

      // Create the print log
      const receipt = await store(requestData)
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
        uuid: '1234567890',
        print_device_id: 1,
      }

      const updatedReceipt = await update(receiptId, updateData)

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
        uuid: '1234567890',
        print_device_id: 1,
      }

      const receipt = await store(requestData)
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
        uuid: '1234567890',
        print_device_id: 1,
      }

      const receipt = await store(requestData)
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
        uuid: '1234567890',
        print_device_id: 1,
      }

      // Create the print log
      const receipt = await store(requestData)
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
        uuid: '1234567890',
        print_device_id: 1,
      }

      const receipt = await store(requestData)
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
          timestamp: startDate,
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
          timestamp: startDate,
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
          timestamp: startDate,
          status: 'failed',
          size: 256,
          pages: 1,
          duration: 5,
          uuid: '1234567890',
          print_device_id: 1,
        },
      ]

      // Create the print logs
      await bulkStore(requests)

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

      // Create the print logs
      await bulkStore(requests)

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
          timestamp: startDate,
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
          timestamp: startDate,
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
          timestamp: startDate,
          status: 'failed',
          size: 256,
          pages: 1,
          duration: 5,
          uuid: '1234567890',
          print_device_id: 1,
        },
      ]

      await bulkStore(requests)

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
          timestamp: startDate,
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
          timestamp: startDate,
          status: 'success',
          size: 512,
          pages: 2,
          duration: 15,
          uuid: '1234567890',
          print_device_id: 1,
        },
      ]

      await bulkStore(requests)

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
        {
          printer: 'HP LaserJet',
          document: 'invoice.pdf',
          timestamp: startDate,
          status: 'success',
          size: 1024,
          pages: 5,
          duration: 30,
          print_device_id: 1,
        },
        {
          printer: 'Epson Printer',
          document: 'report.pdf',
          timestamp: startDate - 86400000, // Yesterday
          status: 'failed',
          size: 2048,
          pages: 10,
          duration: 45,
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
          print_device_id: 1,
        },
      ]

      await bulkStore(requests)

      const stats = await fetchSuccessRate(startDate, endDate)

      // Verify only today's print log is counted
      expect(stats).toBeDefined()
      expect(stats.total).toBe(1)
      expect(stats.success).toBe(1)
      expect(stats.warning).toBe(0)
      expect(stats.failed).toBe(0)
      expect(stats.successRate).toBe(100) // Only today's job was successful
    })

    it('should calculate total pages and average pages per receipt within a date range', async () => {
      const now = Date.now()
      const startDate = now - (now % 86400000) // Start of today
      const endDate = startDate + 86399999 // End of today

      // Create test receipts with different page counts
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
          timestamp: startDate,
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
          timestamp: startDate,
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
          timestamp: startDate,
          status: 'failed',
          size: 256,
          pages: 1,
          duration: 5,
          uuid: '1234567890',
          print_device_id: 1,
        },
      ]

      await bulkStore(requests)

      // Fetch page statistics
      const stats = await fetchPageStats(startDate, endDate)

      // Verify the statistics
      expect(stats).toBeDefined()
      expect(stats.totalReceipts).toBe(4)
      expect(stats.totalPages).toBe(18) // 5 + 10 + 2 + 1
      expect(stats.averagePagesPerReceipt).toBe(5) // 18 / 4 rounded
    })

    it('should return zero statistics when no receipts exist in date range', async () => {
      const now = Date.now()
      const startDate = now - (now % 86400000) // Start of today
      const endDate = startDate + 86399999 // End of today

      const stats = await fetchPageStats(startDate, endDate)

      expect(stats).toBeDefined()
      expect(stats.totalReceipts).toBe(0)
      expect(stats.totalPages).toBe(0)
      expect(stats.averagePagesPerReceipt).toBe(0)
    })

    it('should calculate correct average when all receipts have same page count', async () => {
      const now = Date.now()
      const startDate = now - (now % 86400000) // Start of today
      const endDate = startDate + 86399999 // End of today

      // Create test receipts with same page count
      const requests = [
        {
          printer: 'HP LaserJet',
          document: 'invoice1.pdf',
          timestamp: startDate,
          status: 'success',
          size: 1024,
          pages: 1,
          duration: 30,
          uuid: '1234567890',
          print_device_id: 1,
        },
        {
          printer: 'Epson Printer',
          document: 'invoice2.pdf',
          timestamp: startDate,
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
          timestamp: startDate,
          status: 'success',
          size: 512,
          pages: 1,
          duration: 15,
          uuid: '1234567890',
          print_device_id: 1,
        },
      ]

      await bulkStore(requests)

      const stats = await fetchPageStats(startDate, endDate)

      expect(stats).toBeDefined()
      expect(stats.totalReceipts).toBe(3)
      expect(stats.totalPages).toBe(3)
      expect(stats.averagePagesPerReceipt).toBe(1) // 3 / 3 = 1
    })

    it('should only count receipts within the specified date range for page statistics', async () => {
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

      const stats = await fetchPageStats(startDate, endDate)

      // Verify only today's receipt is counted
      expect(stats).toBeDefined()
      expect(stats.totalReceipts).toBe(1)
      expect(stats.totalPages).toBe(5)
      expect(stats.averagePagesPerReceipt).toBe(5) // 5 / 1 = 5
    })

    it('should calculate print time statistics within a date range', async () => {
      const now = Date.now()
      const startDate = now - (now % 86400000) // Start of today
      const endDate = startDate + 86399999 // End of today

      // Create test receipts with different durations
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
          timestamp: startDate,
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
          timestamp: startDate,
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
          timestamp: startDate,
          status: 'failed',
          size: 256,
          pages: 1,
          duration: 5,
          uuid: '1234567890',
          print_device_id: 1,
        },
      ]

      await bulkStore(requests)

      // Fetch print time statistics
      const stats = await fetchPrintTimeStats(startDate, endDate)

      // Verify the statistics
      expect(stats).toBeDefined()
      expect(stats.totalJobs).toBe(4)
      expect(stats.averageDuration).toBe(24) // (30 + 45 + 15 + 5) / 4 rounded
      expect(stats.minDuration).toBe(5)
      expect(stats.maxDuration).toBe(45)
    })

    it('should return zero statistics when no receipts exist in date range', async () => {
      const now = Date.now()
      const startDate = now - (now % 86400000) // Start of today
      const endDate = startDate + 86399999 // End of today

      const stats = await fetchPrintTimeStats(startDate, endDate)

      expect(stats).toBeDefined()
      expect(stats.totalJobs).toBe(0)
      expect(stats.averageDuration).toBe(0)
      expect(stats.minDuration).toBe(0)
      expect(stats.maxDuration).toBe(0)
    })

    it('should calculate correct statistics when all receipts have same duration', async () => {
      const now = Date.now()
      const startDate = now - (now % 86400000) // Start of today
      const endDate = startDate + 86399999 // End of today

      // Create test receipts with same duration
      const requests = [
        {
          printer: 'HP LaserJet',
          document: 'invoice1.pdf',
          timestamp: startDate,
          status: 'success',
          size: 1024,
          pages: 1,
          duration: 30,
          uuid: '1234567890',
          print_device_id: 1,
        },
        {
          printer: 'Epson Printer',
          document: 'invoice2.pdf',
          timestamp: startDate,
          status: 'success',
          size: 2048,
          pages: 1,
          duration: 30,
          uuid: '1234567890',
          print_device_id: 1,
        },
        {
          printer: 'Canon Printer',
          document: 'invoice3.pdf',
          timestamp: startDate,
          status: 'success',
          size: 512,
          pages: 1,
          duration: 30,
          uuid: '1234567890',
          print_device_id: 1,
        },
      ]

      await bulkStore(requests)

      const stats = await fetchPrintTimeStats(startDate, endDate)

      expect(stats).toBeDefined()
      expect(stats.totalJobs).toBe(3)
      expect(stats.averageDuration).toBe(30)
      expect(stats.minDuration).toBe(30)
      expect(stats.maxDuration).toBe(30)
    })

    it('should only count receipts within the specified date range for print time statistics', async () => {
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

      const stats = await fetchPrintTimeStats(startDate, endDate)

      // Verify only today's receipt is counted
      expect(stats).toBeDefined()
      expect(stats.totalJobs).toBe(1)
      expect(stats.averageDuration).toBe(30)
      expect(stats.minDuration).toBe(30)
      expect(stats.maxDuration).toBe(30)
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
