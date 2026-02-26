import { beforeEach, describe, expect, it } from 'bun:test'
import { refreshDatabase } from '@stacksjs/testing'
import { bulkDestroy } from '../devices/destroy'
import { exportPrintDevices } from '../devices/export'
import { bulkStore, store } from '../devices/store'

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
    })

    it('should return 0 when trying to bulk store an empty array', async () => {
      const count = await bulkStore([])
      expect(count).toBe(0)
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
