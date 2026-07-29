import { beforeEach, describe, expect, it } from 'bun:test'
import { refreshDatabase } from './setup'
import { bulkDestroy, destroy } from '../devices/destroy'
import { exportPrintDevices } from '../devices/export'
import {
  calculateErrorRate,
  countAll,
  countTotalPrints,
  fetchErrorsByDeviceId,
  getPrinterStatusCounts,
} from '../devices/fetch'
import { bulkStore, store } from '../devices/store'
import { updatePrintCount, updateStatus } from '../devices/update'
import { bulkStore as bulkStoreReceipts } from '../receipts/store'

beforeEach(async () => {
  await refreshDatabase()
})

describe('Print Device Module', () => {
  describe('store', () => {
    it('should create multiple print devices with bulk store', async () => {
      const devices = [
        {
          name: 'Printer 1',
          mac_address: '00:11:22:33:44:55',
          location: 'Office 101',
          terminal: 'TERM001',
          status: 'online',
          last_ping: Date.now(),
          print_count: 0,
        },
        {
          name: 'Printer 2',
          mac_address: 'AA:BB:CC:DD:EE:FF',
          location: 'Office 102',
          terminal: 'TERM002',
          status: 'online',
          last_ping: Date.now(),
          print_count: 0,
        },
        {
          name: 'Printer 3',
          mac_address: '11:22:33:44:55:66',
          location: 'Office 103',
          terminal: 'TERM003',
          status: 'online',
          last_ping: Date.now(),
          print_count: 0,
        },
      ]

      const count = await bulkStore(devices)
      expect(count).toBe(3)

      // Verify devices can be fetched
      const { fetchAll } = await import('../devices/fetch')
      const allDevices = await fetchAll()
      expect(allDevices.length).toBeGreaterThanOrEqual(3)

      const stored = await store({
        name: 'Printer 4',
        mac_address: '22:33:44:55:66:77',
        location: 'Office 104',
        terminal: 'TERM004',
        status: 'offline',
        last_ping: Date.now(),
        print_count: 40,
      })
      expect(stored?.name).toBe('Printer 4')

      const warned = await updateStatus(Number(stored?.id), 'warning')
      expect(warned?.status).toBe('warning')
      const counted = await updatePrintCount(Number(stored?.id), 45)
      expect(Number((counted as any)?.print_count)).toBe(45)
      expect(await destroy(Number(stored?.id))).toBe(true)
    })

    it('should return 0 when trying to bulk store an empty array', async () => {
      const count = await bulkStore([])
      expect(count).toBe(0)
    })
  })

  describe('metrics', () => {
    it('calculates device and failed print totals from all persisted rows', async () => {
      await bulkStore([
        { name: 'A', mac_address: '00:00:00:00:00:01', location: 'Front', terminal: 'A', status: 'online', last_ping: Date.now(), print_count: 10 },
        { name: 'B', mac_address: '00:00:00:00:00:02', location: 'Back', terminal: 'B', status: 'offline', last_ping: Date.now(), print_count: 20 },
      ])
      await bulkStoreReceipts([
        { printer: 'A', document: 'One', timestamp: Date.now(), status: 'success', size: 1, pages: 1, duration: 1, print_device_id: 1 },
        { printer: 'A', document: 'Two', timestamp: Date.now(), status: 'failed', size: 1, pages: 1, duration: 1, print_device_id: 1 },
        { printer: 'B', document: 'Three', timestamp: Date.now(), status: 'warning', size: 1, pages: 1, duration: 1, print_device_id: 2 },
      ])

      expect(await countAll()).toBe(2)
      expect(await countTotalPrints()).toBe(30)
      expect(await calculateErrorRate()).toBeCloseTo(33.33, 1)
      expect(await fetchErrorsByDeviceId(1)).toHaveLength(1)
      expect(await getPrinterStatusCounts()).toEqual({ online: 1, offline: 1 })
    })
  })

  describe('destroy', () => {
    it('should return 0 when trying to delete an empty array of devices', async () => {
      // Try to delete with an empty array
      const deletedCount = await bulkDestroy([])
      expect(deletedCount).toBe(0)
    })
  })

  describe('export', () => {
    it('should export print devices to CSV format', async () => {
      // Create a test device
      const deviceData = {
        name: 'Main Printer',
        mac_address: '00:11:22:33:44:55',
        location: 'Office 101',
        terminal: 'TERM001',
        status: 'online',
        last_ping: Date.now(),
        print_count: 100,
      }

      await store(deviceData)

      // Export devices
      const spreadsheet = await exportPrintDevices('csv')
      expect(spreadsheet).toBeDefined()
    })

    it('should export print devices to Excel format', async () => {
      // Create a test device
      const deviceData = {
        name: 'Main Printer',
        mac_address: '00:11:22:33:44:55',
        location: 'Office 101',
        terminal: 'TERM001',
        status: 'online',
        last_ping: Date.now(),
        print_count: 100,
      }

      await store(deviceData)

      // Export devices
      const spreadsheet = await exportPrintDevices('excel')
      expect(spreadsheet).toBeDefined()
    })

    it('should handle empty device list during export', async () => {
      const spreadsheet = await exportPrintDevices('csv')
      expect(spreadsheet).toBeDefined()
    })
  })
})
