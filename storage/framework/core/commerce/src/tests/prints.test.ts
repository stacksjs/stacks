import type { PrintLogJsonResponse } from '@stacksjs/orm'
import { beforeEach, describe, expect, it } from 'bun:test'
import { formatDate } from '@stacksjs/orm'
import { refreshDatabase } from '@stacksjs/testing'
import { bulkDestroy, destroy } from '../prints/destroy'
import { fetchAll, fetchById } from '../prints/fetch'
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
        timestamp: formatDate(new Date()),
        status: 'success',
        size: 1024,
        pages: 5,
        duration: 30,
      }

      const request = new TestRequest(requestData)
      const printLog = await store(request as any)

      expect(printLog).toBeDefined()
      expect(printLog?.printer).toBe('HP LaserJet')
      expect(printLog?.document).toBe('invoice.pdf')
      expect(printLog?.status).toBe('success')
      expect(printLog?.size).toBe(1024)
      expect(printLog?.pages).toBe(5)
      expect(printLog?.duration).toBe(30)
      expect(printLog?.uuid).toBeDefined()

      // Save the ID for further testing
      const printId = printLog?.id !== undefined ? Number(printLog.id) : undefined

      // Verify we can fetch the print log we just created
      if (printId) {
        const fetchedPrint = await fetchById(printId)
        expect(fetchedPrint).toBeDefined()
        expect(fetchedPrint?.id).toBe(printId)
      }
    })

    it('should create a print log with minimal required fields', async () => {
      const minimalRequestData = {
        printer: 'Epson Printer',
        document: 'report.pdf',
        timestamp: formatDate(new Date()),
        status: 'success',
      }

      const request = new TestRequest(minimalRequestData)
      const printLog = await store(request as any)

      expect(printLog).toBeDefined()
      expect(printLog?.printer).toBe('Epson Printer')
      expect(printLog?.document).toBe('report.pdf')
      expect(printLog?.status).toBe('success')
      expect(printLog?.size).toBeNull()
      expect(printLog?.pages).toBeNull()
      expect(printLog?.duration).toBeNull()
      expect(printLog?.uuid).toBeDefined()
    })

    it('should create multiple print logs with bulk store', async () => {
      const requests = [
        new TestRequest({
          printer: 'HP LaserJet',
          document: 'invoice.pdf',
          timestamp: formatDate(new Date()),
          status: 'success',
          size: 1024,
          pages: 5,
          duration: 30,
        }),
        new TestRequest({
          printer: 'Epson Printer',
          document: 'report.pdf',
          timestamp: formatDate(new Date()),
          status: 'warning',
          size: 2048,
          pages: 10,
          duration: 45,
        }),
        new TestRequest({
          printer: 'Canon Printer',
          document: 'document.pdf',
          timestamp: formatDate(new Date()),
          status: 'failed',
          size: 512,
          pages: 2,
          duration: 15,
        }),
      ]

      const count = await bulkStore(requests as any)
      expect(count).toBe(3)

      // Verify print logs can be fetched
      const allPrintLogs = await fetchAll()
      expect(allPrintLogs.length).toBeGreaterThanOrEqual(3)
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
        timestamp: formatDate(new Date()),
        status: 'success',
        size: 1024,
        pages: 5,
        duration: 30,
      }

      // Create the print log
      const createRequest = new TestRequest(requestData)
      const printLog = await store(createRequest as any)
      const printId = printLog?.id !== undefined ? Number(printLog.id) : undefined

      // Make sure we have a valid print ID before proceeding
      expect(printId).toBeDefined()
      if (!printId) {
        throw new Error('Failed to create test print log')
      }

      // Update the print log with new data
      const updateData = {
        printer: 'HP LaserJet Pro',
        document: 'updated_invoice.pdf',
        timestamp: formatDate(new Date()),
        status: 'warning',
        size: 2048,
        pages: 10,
        duration: 45,
      }

      const updateRequest = new TestRequest(updateData)
      const updatedPrint = await update(printId, updateRequest as any)

      // Verify the update was successful
      expect(updatedPrint).toBeDefined()
      expect(updatedPrint?.id).toBe(printId)
      expect(updatedPrint?.printer).toBe('HP LaserJet Pro')
      expect(updatedPrint?.document).toBe('updated_invoice.pdf')
      expect(updatedPrint?.status).toBe('warning')
      expect(updatedPrint?.size).toBe(2048)
      expect(updatedPrint?.pages).toBe(10)
      expect(updatedPrint?.duration).toBe(45)
    })

    it('should update a print log\'s status', async () => {
      // Create a print log
      const requestData = {
        printer: 'HP LaserJet',
        document: 'invoice.pdf',
        timestamp: formatDate(new Date()),
        status: 'success',
        size: 1024,
        pages: 5,
        duration: 30,
      }

      const request = new TestRequest(requestData)
      const printLog = await store(request as any)
      const printId = printLog?.id !== undefined ? Number(printLog.id) : undefined

      // Make sure we have a valid print ID before proceeding
      expect(printId).toBeDefined()
      if (!printId) {
        throw new Error('Failed to create test print log')
      }

      // Update status to warning
      const updatedPrint = await updateStatus(printId, 'warning')
      expect(updatedPrint).toBeDefined()
      expect(updatedPrint?.status).toBe('warning')

      // Update status to failed
      const failedPrint = await updateStatus(printId, 'failed')
      expect(failedPrint).toBeDefined()
      expect(failedPrint?.status).toBe('failed')
    })

    it('should update print job information', async () => {
      // Create a print log
      const requestData = {
        printer: 'HP LaserJet',
        document: 'invoice.pdf',
        timestamp: formatDate(new Date()),
        status: 'success',
        size: 1024,
        pages: 5,
        duration: 30,
      }

      const request = new TestRequest(requestData)
      const printLog = await store(request as any)
      const printId = printLog?.id !== undefined ? Number(printLog.id) : undefined

      expect(printId).toBeDefined()
      if (!printId) {
        throw new Error('Failed to create test print log')
      }

      // Update print job information
      const updatedPrint = await updatePrintJob(printId, 2048, 10, 45)

      expect(updatedPrint).toBeDefined()
      expect(updatedPrint?.size).toBe(2048)
      expect(updatedPrint?.pages).toBe(10)
      expect(updatedPrint?.duration).toBe(45)
    })
  })

  describe('destroy', () => {
    it('should delete a print log from the database', async () => {
      // First create a print log to delete
      const requestData = {
        printer: 'HP LaserJet',
        document: 'invoice.pdf',
        timestamp: formatDate(new Date()),
        status: 'success',
        size: 1024,
        pages: 5,
        duration: 30,
      }

      // Create the print log
      const request = new TestRequest(requestData)
      const printLog = await store(request as any)
      const printId = printLog?.id !== undefined ? Number(printLog.id) : undefined

      // Make sure we have a valid print ID before proceeding
      expect(printId).toBeDefined()
      if (!printId) {
        throw new Error('Failed to create test print log')
      }

      // Verify the print log exists
      let fetchedPrint = await fetchById(printId)
      expect(fetchedPrint).toBeDefined()

      // Delete the print log
      const deleted = await destroy(printId)
      expect(deleted).toBe(true)

      // Verify the print log no longer exists
      fetchedPrint = await fetchById(printId)
      expect(fetchedPrint).toBeUndefined()
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
          timestamp: formatDate(new Date()),
          status: 'success',
          size: 1024,
          pages: 5,
          duration: 30,
        }),
        new TestRequest({
          printer: 'Epson Printer',
          document: 'report.pdf',
          timestamp: formatDate(new Date()),
          status: 'warning',
          size: 2048,
          pages: 10,
          duration: 45,
        }),
        new TestRequest({
          printer: 'Canon Printer',
          document: 'document.pdf',
          timestamp: formatDate(new Date()),
          status: 'failed',
          size: 512,
          pages: 2,
          duration: 15,
        }),
      ]

      // Create the print logs
      await bulkStore(requests as any)

      // Fetch all print logs
      const allPrintLogs = await fetchAll()
      expect(allPrintLogs).toBeDefined()
      expect(allPrintLogs.length).toBe(3)
      expect(allPrintLogs.map((p: PrintLogJsonResponse) => p.printer)).toContain('HP LaserJet')
      expect(allPrintLogs.map((p: PrintLogJsonResponse) => p.printer)).toContain('Epson Printer')
      expect(allPrintLogs.map((p: PrintLogJsonResponse) => p.printer)).toContain('Canon Printer')
    })

    it('should fetch a print log by ID', async () => {
      // Create a print log
      const requestData = {
        printer: 'HP LaserJet',
        document: 'invoice.pdf',
        timestamp: formatDate(new Date()),
        status: 'success',
        size: 1024,
        pages: 5,
        duration: 30,
      }

      const request = new TestRequest(requestData)
      const printLog = await store(request as any)
      const printId = printLog?.id !== undefined ? Number(printLog.id) : undefined

      expect(printId).toBeDefined()
      if (!printId) {
        throw new Error('Failed to create test print log')
      }

      // Fetch the print log by ID
      const fetchedPrint = await fetchById(printId)
      expect(fetchedPrint).toBeDefined()
      expect(fetchedPrint?.id).toBe(printId)
      expect(fetchedPrint?.printer).toBe('HP LaserJet')
      expect(fetchedPrint?.document).toBe('invoice.pdf')
      expect(fetchedPrint?.status).toBe('success')
      expect(fetchedPrint?.size).toBe(1024)
      expect(fetchedPrint?.pages).toBe(5)
      expect(fetchedPrint?.duration).toBe(30)
    })
  })
})
