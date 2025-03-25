import { beforeEach, describe, expect, it } from 'bun:test'
import { refreshDatabase } from '@stacksjs/testing'
import { bulkDestroy, destroy } from '../drivers/destroy'
import { fetchAll, fetchById } from '../drivers/fetch'
import { bulkStore, store } from '../drivers/store'
import { update, updateContact, updateStatus } from '../drivers/update'

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

describe('Driver Module', () => {
  describe('store', () => {
    it('should create a new driver in the database', async () => {
      const requestData = {
        name: 'John Doe',
        phone: '+1234567890',
        vehicle_number: 'ABC123',
        license: 'DL123456',
        status: 'active',
      }

      const request = new TestRequest(requestData)
      const driver = await store(request as any)

      expect(driver).toBeDefined()
      expect(driver?.name).toBe('John Doe')
      expect(driver?.phone).toBe('+1234567890')
      expect(driver?.vehicle_number).toBe('ABC123')
      expect(driver?.license).toBe('DL123456')
      expect(driver?.status).toBe('active')
      expect(driver?.uuid).toBeDefined()

      // Save the ID for further testing
      const driverId = driver?.id !== undefined ? Number(driver.id) : undefined

      // Verify we can fetch the driver we just created
      if (driverId) {
        const fetchedDriver = await fetchById(driverId)
        expect(fetchedDriver).toBeDefined()
        expect(fetchedDriver?.id).toBe(driverId)
      }
    })

    it('should create a driver with minimal required fields', async () => {
      const minimalRequestData = {
        name: 'Jane Smith',
        phone: '+1987654321',
        vehicle_number: 'XYZ789',
        license: 'DL789012',
        status: 'active',
      }

      const request = new TestRequest(minimalRequestData)
      const driver = await store(request as any)

      expect(driver).toBeDefined()
      expect(driver?.name).toBe('Jane Smith')
      expect(driver?.phone).toBe('+1987654321')
      expect(driver?.vehicle_number).toBe('XYZ789')
      expect(driver?.license).toBe('DL789012')
      expect(driver?.status).toBe('active')
      expect(driver?.uuid).toBeDefined()
    })

    it('should create multiple drivers with bulk store', async () => {
      const requests = [
        new TestRequest({
          name: 'John Doe',
          phone: '+1234567890',
          vehicle_number: 'ABC123',
          license: 'DL123456',
          status: 'active',
        }),
        new TestRequest({
          name: 'Jane Smith',
          phone: '+1987654321',
          vehicle_number: 'XYZ789',
          license: 'DL789012',
          status: 'on_break',
        }),
        new TestRequest({
          name: 'Bob Wilson',
          phone: '+1122334455',
          vehicle_number: 'DEF456',
          license: 'DL345678',
          status: 'on_delivery',
        }),
      ]

      const count = await bulkStore(requests as any)
      expect(count).toBe(3)

      // Verify drivers can be fetched
      const allDrivers = await fetchAll()
      expect(allDrivers.length).toBeGreaterThanOrEqual(3)
    })

    it('should return 0 when trying to bulk store an empty array', async () => {
      const count = await bulkStore([])
      expect(count).toBe(0)
    })
  })

  describe('update', () => {
    it('should update an existing driver', async () => {
      // First create a driver to update
      const requestData = {
        name: 'John Doe',
        phone: '+1234567890',
        vehicle_number: 'ABC123',
        license: 'DL123456',
        status: 'active',
      }

      // Create the driver
      const createRequest = new TestRequest(requestData)
      const driver = await store(createRequest as any)
      const driverId = driver?.id !== undefined ? Number(driver.id) : undefined

      // Make sure we have a valid driver ID before proceeding
      expect(driverId).toBeDefined()
      if (!driverId) {
        throw new Error('Failed to create test driver')
      }

      // Update the driver with new data
      const updateData = {
        name: 'John Doe Jr',
        phone: '+1987654321',
        vehicle_number: 'XYZ789',
        license: 'DL789012',
        status: 'on_delivery',
      }

      const updateRequest = new TestRequest(updateData)
      const updatedDriver = await update(driverId, updateRequest as any)

      // Verify the update was successful
      expect(updatedDriver).toBeDefined()
      expect(updatedDriver?.id).toBe(driverId)
      expect(updatedDriver?.name).toBe('John Doe Jr')
      expect(updatedDriver?.phone).toBe('+1987654321')
      expect(updatedDriver?.vehicle_number).toBe('XYZ789')
      expect(updatedDriver?.license).toBe('DL789012')
      expect(updatedDriver?.status).toBe('on_delivery')
    })

    it('should update a driver\'s status', async () => {
      // Create a driver
      const requestData = {
        name: 'John Doe',
        phone: '+1234567890',
        vehicle_number: 'ABC123',
        license: 'DL123456',
        status: 'active',
      }

      const request = new TestRequest(requestData)
      const driver = await store(request as any)
      const driverId = driver?.id !== undefined ? Number(driver.id) : undefined

      // Make sure we have a valid driver ID before proceeding
      expect(driverId).toBeDefined()
      if (!driverId) {
        throw new Error('Failed to create test driver')
      }

      // Update status to on_delivery
      const updatedDriver = await updateStatus(driverId, 'on_delivery')
      expect(updatedDriver).toBeDefined()
      expect(updatedDriver?.status).toBe('on_delivery')

      // Update status to on_break
      const breakDriver = await updateStatus(driverId, 'on_break')
      expect(breakDriver).toBeDefined()
      expect(breakDriver?.status).toBe('on_break')
    })

    it('should update contact information', async () => {
      // Create a driver
      const requestData = {
        name: 'John Doe',
        phone: '+1234567890',
        vehicle_number: 'ABC123',
        license: 'DL123456',
        status: 'active',
      }

      const request = new TestRequest(requestData)
      const driver = await store(request as any)
      const driverId = driver?.id !== undefined ? Number(driver.id) : undefined

      expect(driverId).toBeDefined()
      if (!driverId) {
        throw new Error('Failed to create test driver')
      }

      // Update phone number
      const newPhone = '+1987654321'
      const updatedDriver = await updateContact(driverId, newPhone)

      expect(updatedDriver).toBeDefined()
      expect(updatedDriver?.phone).toBe(newPhone)
    })
  })

  describe('destroy', () => {
    it('should delete a driver from the database', async () => {
      // First create a driver to delete
      const requestData = {
        name: 'John Doe',
        phone: '+1234567890',
        vehicle_number: 'ABC123',
        license: 'DL123456',
        status: 'active',
      }

      // Create the driver
      const request = new TestRequest(requestData)
      const driver = await store(request as any)
      const driverId = driver?.id !== undefined ? Number(driver.id) : undefined

      // Make sure we have a valid driver ID before proceeding
      expect(driverId).toBeDefined()
      if (!driverId) {
        throw new Error('Failed to create test driver')
      }

      // Verify the driver exists
      let fetchedDriver = await fetchById(driverId)
      expect(fetchedDriver).toBeDefined()

      // Delete the driver
      const deletedDriver = await destroy(driverId)
      expect(deletedDriver).toBeDefined()
      expect(deletedDriver?.id).toBe(driverId)

      // Verify the driver no longer exists
      fetchedDriver = await fetchById(driverId)
      expect(fetchedDriver).toBeUndefined()
    })

    it('should delete multiple drivers from the database', async () => {
      // Create several drivers to delete
      const driverIds = []

      // Create 3 test drivers
      for (let i = 0; i < 3; i++) {
        const requestData = {
          name: `Driver ${i + 1}`,
          phone: `+123456789${i}`,
          vehicle_number: `ABC${i + 1}`,
          license: `DL${i + 1}`,
          status: 'active',
        }

        const request = new TestRequest(requestData)
        const driver = await store(request as any)

        const driverId = driver?.id !== undefined ? Number(driver.id) : undefined
        expect(driverId).toBeDefined()

        if (driverId) {
          driverIds.push(driverId)
        }
      }

      // Ensure we have created the drivers
      expect(driverIds.length).toBe(3)

      // Delete the drivers
      const deletedCount = await bulkDestroy(driverIds)
      expect(deletedCount).toBe(3)

      // Verify the drivers no longer exist
      for (const id of driverIds) {
        const fetchedDriver = await fetchById(id)
        expect(fetchedDriver).toBeUndefined()
      }
    })

    it('should return 0 when trying to delete an empty array of drivers', async () => {
      // Try to delete with an empty array
      const deletedCount = await bulkDestroy([])
      expect(deletedCount).toBe(0)
    })
  })
})
