import { beforeEach, describe, expect, it } from 'bun:test'
import { refreshDatabase } from '@stacksjs/testing'
import { bulkDestroy, destroy } from '../shippings/drivers/destroy'
import { fetchAll, fetchById } from '../shippings/drivers/fetch'
import { bulkStore, store } from '../shippings/drivers/store'
import { update, updateContact, updateStatus } from '../shippings/drivers/update'

beforeEach(async () => {
  await refreshDatabase()
})

describe('Driver Module', () => {
  describe('store', () => {
    it('should create a new driver in the database', async () => {
      const requestData = {
        user_id: 1,
        name: 'John Doe',
        phone: '+1234567890',
        vehicle_number: 'ABC123',
        license: 'DL123456',
        status: 'active',
      }

      const driver = await store(requestData)

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
        user_id: 1,
      }

      const driver = await store(minimalRequestData)

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
        {
          name: 'John Doe',
          phone: '+1234567890',
          vehicle_number: 'ABC123',
          license: 'DL123456',
          status: 'active',
          user_id: 1,
        },
        {
          name: 'Jane Smith',
          phone: '+1987654321',
          vehicle_number: 'XYZ789',
          license: 'DL789012',
          status: 'on_break',
          user_id: 1,
        },
        {
          name: 'Bob Wilson',
          phone: '+1122334455',
          vehicle_number: 'DEF456',
          license: 'DL345678',
          status: 'on_delivery',
          user_id: 1,
        },
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
        user_id: 1,
      }

      // Create the driver
      const driver = await store(requestData)
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

      const updatedDriver = await update(driverId, updateData)

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
        user_id: 1,
      }

      const driver = await store(requestData)
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
        user_id: 1,
      }

      const driver = await store(requestData)
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
        user_id: 1,
      }

      // Create the driver
      const driver = await store(requestData)
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

    it('should return 0 when trying to delete an empty array of drivers', async () => {
      // Try to delete with an empty array
      const deletedCount = await bulkDestroy([])
      expect(deletedCount).toBe(0)
    })
  })
})
