import { beforeEach, describe, expect, it } from 'bun:test'
import { refreshDatabase } from '@stacksjs/testing'
import { bulkDestroy, destroy } from '../devices/destroy'
import { exportPrintDevices } from '../devices/export'
import { calculateErrorRate, calculatePrinterHealth, countPrintsByDeviceId, countTotalPrints, fetchAll, fetchById, getPrinterStatusCounts } from '../devices/fetch'
import { bulkStore, store } from '../devices/store'
import { update, updatePrintCount, updateStatus } from '../devices/update'
import { store as storeReceipt } from '../receipts/store'

beforeEach(async () => {
  await refreshDatabase()
})

describe('Print Device Module', () => {
  describe('store', () => {
    it('should create a new print device in the database', async () => {
      const deviceData = {
        name: 'Main Printer',
        mac_address: '00:11:22:33:44:55',
        location: 'Office 101',
        terminal: 'TERM001',
        status: 'online',
        last_ping: Date.now(),
        print_count: 0,
      }

      const device = await store(deviceData)

      expect(device).toBeDefined()
      expect(device?.name).toBe('Main Printer')
      expect(device?.mac_address).toBe('00:11:22:33:44:55')
      expect(device?.location).toBe('Office 101')
      expect(device?.terminal).toBe('TERM001')
      expect(device?.status).toBe('online')
      expect(device?.print_count).toBe(0)
      expect(device?.uuid).toBeDefined()

      // Save the ID for further testing
      const deviceId = device?.id !== undefined ? Number(device.id) : undefined

      // Verify we can fetch the device we just created
      if (deviceId) {
        const fetchedDevice = await fetchById(deviceId)
        expect(fetchedDevice).toBeDefined()
        expect(fetchedDevice?.id).toBe(deviceId)
      }
    })

    it('should create a print device with minimal required fields', async () => {
      const minimalDeviceData = {
        name: 'Backup Printer',
        mac_address: 'AA:BB:CC:DD:EE:FF',
        location: 'Server Room',
        terminal: 'TERM002',
        status: 'offline',
        last_ping: Date.now(),
        print_count: 0,
      }

      const device = await store(minimalDeviceData)

      expect(device).toBeDefined()
      expect(device?.name).toBe('Backup Printer')
      expect(device?.mac_address).toBe('AA:BB:CC:DD:EE:FF')
      expect(device?.location).toBe('Server Room')
      expect(device?.terminal).toBe('TERM002')
      expect(device?.status).toBe('offline') // Default value
      expect(device?.print_count).toBe(0) // Default value
      expect(device?.uuid).toBeDefined()
    })

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
      const allDevices = await fetchAll()
      expect(allDevices.length).toBeGreaterThanOrEqual(3)
    })

    it('should return 0 when trying to bulk store an empty array', async () => {
      const count = await bulkStore([])
      expect(count).toBe(0)
    })
  })

  describe('update', () => {
    it('should update an existing print device', async () => {
      // First create a device to update
      const deviceData = {
        name: 'Main Printer',
        mac_address: '00:11:22:33:44:55',
        location: 'Office 101',
        terminal: 'TERM001',
        status: 'online',
        last_ping: Date.now(),
        print_count: 0,
      }

      // Create the device
      const device = await store(deviceData)
      const deviceId = device?.id !== undefined ? Number(device.id) : undefined

      // Make sure we have a valid device ID before proceeding
      expect(deviceId).toBeDefined()
      if (!deviceId) {
        throw new Error('Failed to create test device')
      }

      const updateData = {
        name: 'Updated Printer',
        mac_address: '00:11:22:33:44:66',
        location: 'Office 102',
        terminal: 'TERM002',
        status: 'online',
        last_ping: Date.now(),
        print_count: 100,
      }

      const updatedDevice = await update(deviceId, updateData)

      // Verify the update was successful
      expect(updatedDevice).toBeDefined()
      expect(updatedDevice?.id).toBe(deviceId)
      expect(updatedDevice?.name).toBe('Updated Printer')
      expect(updatedDevice?.mac_address).toBe('00:11:22:33:44:66')
      expect(updatedDevice?.location).toBe('Office 102')
      expect(updatedDevice?.terminal).toBe('TERM002')
      expect(updatedDevice?.status).toBe('online')
      expect(updatedDevice?.print_count).toBe(100)
    })

    it('should update a device\'s status', async () => {
      // Create a device
      const deviceData = {
        name: 'Main Printer',
        mac_address: '00:11:22:33:44:55',
        location: 'Office 101',
        terminal: 'TERM001',
        status: 'online',
        last_ping: Date.now(),
        print_count: 0,
      }

      const device = await store(deviceData)
      const deviceId = device?.id !== undefined ? Number(device.id) : undefined

      // Make sure we have a valid device ID before proceeding
      expect(deviceId).toBeDefined()
      if (!deviceId) {
        throw new Error('Failed to create test device')
      }

      // Update status to offline
      const updatedDevice = await updateStatus(deviceId, 'offline')
      expect(updatedDevice).toBeDefined()
      expect(updatedDevice?.status).toBe('offline')

      // Update status to warning
      const warningDevice = await updateStatus(deviceId, 'warning')
      expect(warningDevice).toBeDefined()
      expect(warningDevice?.status).toBe('warning')
    })

    it('should update print count', async () => {
      // Create a device
      const deviceData = {
        name: 'Main Printer',
        mac_address: '00:11:22:33:44:55',
        location: 'Office 101',
        terminal: 'TERM001',
        status: 'online',
        last_ping: Date.now(),
        print_count: 0,
      }

      const device = await store(deviceData)
      const deviceId = device?.id !== undefined ? Number(device.id) : undefined

      expect(deviceId).toBeDefined()
      if (!deviceId) {
        throw new Error('Failed to create test device')
      }

      // Update print count
      const updatedDevice = await updatePrintCount(deviceId, 100)
      expect(updatedDevice).toBeDefined()
      expect(updatedDevice?.print_count).toBe(100)
    })
  })

  describe('destroy', () => {
    it('should delete a print device from the database', async () => {
      // First create a device to delete
      const deviceData = {
        name: 'Main Printer',
        mac_address: '00:11:22:33:44:55',
        location: 'Office 101',
        terminal: 'TERM001',
        status: 'online',
        last_ping: Date.now(),
        print_count: 0,
      }

      // Create the device
      const device = await store(deviceData)
      const deviceId = device?.id !== undefined ? Number(device.id) : undefined

      // Make sure we have a valid device ID before proceeding
      expect(deviceId).toBeDefined()
      if (!deviceId) {
        throw new Error('Failed to create test device')
      }

      // Verify the device exists
      let fetchedDevice = await fetchById(deviceId)
      expect(fetchedDevice).toBeDefined()

      // Delete the device
      const result = await destroy(deviceId)
      expect(result).toBe(true)

      // Verify the device no longer exists
      fetchedDevice = await fetchById(deviceId)
      expect(fetchedDevice).toBeUndefined()
    })

    it('should delete multiple print devices from the database', async () => {
      // Create several devices to delete
      const deviceIds = []

      // Create 3 test devices
      for (let i = 0; i < 3; i++) {
        const deviceData = {
          name: `Printer ${i}`,
          mac_address: `00:11:22:33:44:${i.toString().padStart(2, '0')}`,
          location: `Office ${100 + i}`,
          terminal: `TERM${(i + 1).toString().padStart(3, '0')}`,
          status: 'online',
          last_ping: Date.now(),
          print_count: 0,
        }

        const device = await store(deviceData)

        const deviceId = device?.id !== undefined ? Number(device.id) : undefined
        expect(deviceId).toBeDefined()

        if (deviceId) {
          deviceIds.push(deviceId)
        }
      }

      // Ensure we have created the devices
      expect(deviceIds.length).toBe(3)

      // Delete the devices
      const deletedCount = await bulkDestroy(deviceIds)
      expect(deletedCount).toBe(3)

      // Verify the devices no longer exist
      for (const id of deviceIds) {
        const fetchedDevice = await fetchById(id)
        expect(fetchedDevice).toBeUndefined()
      }
    })

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

  describe('print counting', () => {
    it('should count total prints across all devices', async () => {
      // Create a test device
      const deviceData = {
        name: 'Main Printer',
        mac_address: '00:11:22:33:44:55',
        location: 'Office 101',
        terminal: 'TERM001',
        status: 'online',
        last_ping: Date.now(),
        print_count: 0,
      }

      const device = await store(deviceData)
      const deviceId = device?.id !== undefined ? Number(device.id) : undefined

      expect(deviceId).toBeDefined()
      if (!deviceId) {
        throw new Error('Failed to create test device')
      }

      // Update print count for the device
      await updatePrintCount(deviceId, 100)

      // Count total prints
      const totalPrints = await countTotalPrints()
      expect(totalPrints).toBe(100)
    })

    it('should count prints for a specific device', async () => {
      // Create two test devices
      const device1Data = {
        name: 'Printer 1',
        mac_address: '00:11:22:33:44:55',
        location: 'Office 101',
        terminal: 'TERM001',
        status: 'online',
        last_ping: Date.now(),
        print_count: 0,
      }

      const device2Data = {
        name: 'Printer 2',
        mac_address: 'AA:BB:CC:DD:EE:FF',
        location: 'Office 102',
        terminal: 'TERM002',
        status: 'online',
        last_ping: Date.now(),
        print_count: 0,
      }

      const device1 = await store(device1Data)
      const device2 = await store(device2Data)

      const device1Id = device1?.id !== undefined ? Number(device1.id) : undefined
      const device2Id = device2?.id !== undefined ? Number(device2.id) : undefined

      expect(device1Id).toBeDefined()
      expect(device2Id).toBeDefined()

      if (!device1Id || !device2Id) {
        throw new Error('Failed to create test devices')
      }

      // Update print counts for both devices
      await updatePrintCount(device1Id, 50)
      await updatePrintCount(device2Id, 75)

      // Count prints for each device
      const device1Prints = await countPrintsByDeviceId(device1Id)
      const device2Prints = await countPrintsByDeviceId(device2Id)

      expect(device1Prints).toBe(50)
      expect(device2Prints).toBe(75)
    })

    it('should return 0 when counting prints for non-existent device', async () => {
      const nonExistentDeviceId = 99999
      const prints = await countPrintsByDeviceId(nonExistentDeviceId)
      expect(prints).toBe(0)
    })
  })

  describe('error rate calculation', () => {
    it('should calculate 0% error rate when no receipts exist', async () => {
      const errorRate = await calculateErrorRate()
      expect(errorRate).toBe(0)
    })

    it('should calculate 0% error rate when no receipts have error status', async () => {
      // Create a test device first
      const deviceData = {
        name: 'Test Printer',
        mac_address: '00:11:22:33:44:55',
        location: 'Office 101',
        terminal: 'TERM001',
        status: 'online',
        last_ping: Date.now(),
        print_count: 0,
      }

      const device = await store(deviceData)
      const deviceId = device?.id !== undefined ? Number(device.id) : undefined

      expect(deviceId).toBeDefined()
      if (!deviceId) {
        throw new Error('Failed to create test device')
      }

      await storeReceipt({
        printer: 'Main Printer',
        document: 'Test Document',
        timestamp: Date.now(),
        status: 'success',
        duration: 100,
        size: 100,
        pages: 1,
        print_device_id: deviceId,
      })

      await storeReceipt({
        printer: 'Main2 Printer',
        document: 'Test Document',
        timestamp: Date.now(),
        status: 'success',
        duration: 100,
        size: 100,
        pages: 1,
        print_device_id: deviceId,
      })

      await storeReceipt({
        printer: 'Main3 Printer',
        document: 'Test Document',
        timestamp: Date.now(),
        status: 'success',
        duration: 100,
        size: 100,
        pages: 1,
        print_device_id: deviceId,
      })

      const errorRate = await calculateErrorRate()
      expect(errorRate).toBe(0)
    })

    it('should calculate correct error rate percentage from receipts', async () => {
      // Create a test device first
      const deviceData = {
        name: 'Test Printer',
        mac_address: '00:11:22:33:44:55',
        location: 'Office 101',
        terminal: 'TERM001',
        status: 'online',
        last_ping: Date.now(),
        print_count: 0,
      }

      const device = await store(deviceData)
      const deviceId = device?.id !== undefined ? Number(device.id) : undefined

      expect(deviceId).toBeDefined()
      if (!deviceId) {
        throw new Error('Failed to create test device')
      }

      await storeReceipt({
        printer: 'Main12 Printer',
        document: 'Test Document',
        timestamp: Date.now(),
        status: 'error',
        duration: 100,
        size: 100,
        pages: 1,
        print_device_id: deviceId,
      })

      await storeReceipt({
        printer: 'Main34 Printer',
        document: 'Test Document',
        timestamp: Date.now(),
        status: 'success',
        duration: 100,
        size: 100,
        pages: 1,
        print_device_id: deviceId,
      })

      await storeReceipt({
        printer: 'Main2 Printer',
        document: 'Test Document',
        timestamp: Date.now(),
        status: 'error',
        duration: 100,
        size: 100,
        pages: 1,
        print_device_id: deviceId,
      })

      await storeReceipt({
        printer: 'Main33 Printer',
        document: 'Test Document',
        timestamp: Date.now(),
        status: 'success',
        duration: 100,
        size: 100,
        pages: 1,
        print_device_id: deviceId,
      })

      const errorRate = await calculateErrorRate()
      expect(errorRate).toBe(50) // 2 out of 4 receipts have error status
    })
  })

  describe('printer health calculation', () => {
    it('should calculate 0% health when no printers exist', async () => {
      const health = await calculatePrinterHealth()
      expect(health).toBe(0)
    })

    it('should calculate 100% health when all printers are online', async () => {
      // Create multiple online printers
      const printers = [
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

      for (const printer of printers) {
        await store(printer)
      }

      const health = await calculatePrinterHealth()
      expect(health).toBe(100)
    })

    it('should calculate correct health percentage with mixed printer statuses', async () => {
      // Create printers with different statuses
      const printers = [
        {
          name: 'Online Printer',
          mac_address: '00:11:22:33:44:55',
          location: 'Office 101',
          terminal: 'TERM001',
          status: 'online',
          last_ping: Date.now(),
          print_count: 0,
        },
        {
          name: 'Offline Printer',
          mac_address: 'AA:BB:CC:DD:EE:FF',
          location: 'Office 102',
          terminal: 'TERM002',
          status: 'offline',
          last_ping: Date.now(),
          print_count: 0,
        },
        {
          name: 'Warning Printer',
          mac_address: '11:22:33:44:55:66',
          location: 'Office 103',
          terminal: 'TERM003',
          status: 'warning',
          last_ping: Date.now(),
          print_count: 0,
        },
        {
          name: 'Online Printer 2',
          mac_address: '22:33:44:55:66:77',
          location: 'Office 104',
          terminal: 'TERM004',
          status: 'online',
          last_ping: Date.now(),
          print_count: 0,
        },
      ]

      for (const printer of printers) {
        await store(printer)
      }

      const health = await calculatePrinterHealth()
      expect(health).toBe(50) // 2 out of 4 printers are online
    })
  })

  describe('printer status counts', () => {
    it('should return empty object when no printers exist', async () => {
      const counts = await getPrinterStatusCounts()
      expect(counts).toEqual({})
    })

    it('should return correct counts for each status', async () => {
      // Create printers with different statuses
      const printers = [
        {
          name: 'Online Printer 1',
          mac_address: '00:11:22:33:44:55',
          location: 'Office 101',
          terminal: 'TERM001',
          status: 'online',
          last_ping: Date.now(),
          print_count: 0,
        },
        {
          name: 'Online Printer 2',
          mac_address: 'AA:BB:CC:DD:EE:FF',
          location: 'Office 102',
          terminal: 'TERM002',
          status: 'online',
          last_ping: Date.now(),
          print_count: 0,
        },
        {
          name: 'Offline Printer',
          mac_address: '11:22:33:44:55:66',
          location: 'Office 103',
          terminal: 'TERM003',
          status: 'offline',
          last_ping: Date.now(),
          print_count: 0,
        },
        {
          name: 'Warning Printer',
          mac_address: '22:33:44:55:66:77',
          location: 'Office 104',
          terminal: 'TERM004',
          status: 'warning',
          last_ping: Date.now(),
          print_count: 0,
        },
      ]

      for (const printer of printers) {
        await store(printer)
      }

      const counts = await getPrinterStatusCounts()
      expect(counts).toEqual({
        online: 2,
        offline: 1,
        warning: 1,
      })
    })
  })
})
