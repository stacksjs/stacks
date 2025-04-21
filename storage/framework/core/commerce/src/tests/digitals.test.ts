import { beforeEach, describe, expect, it } from 'bun:test'
import { refreshDatabase } from '@stacksjs/testing'
import { bulkDestroy, bulkSoftDelete, destroy, softDelete } from '../shippings/digital-deliveries/destroy'
import { fetchAll, fetchById } from '../shippings/digital-deliveries/fetch'
import { bulkStore, store } from '../shippings/digital-deliveries/store'
import { update, updateDeliverySettings, updateStatus } from '../shippings/digital-deliveries/update'

beforeEach(async () => {
  await refreshDatabase()
})

describe('Digital Delivery Module', () => {
  describe('store', () => {
    it('should create a new digital delivery in the database', async () => {
      const requestData = {
        name: 'Premium Ebook',
        description: 'A comprehensive guide to digital marketing',
        download_limit: 5,
        expiry_days: 30,
        requires_login: true,
        automatic_delivery: true,
        status: 'active',
      }

      const delivery = await store(requestData)

      expect(delivery).toBeDefined()
      expect(delivery?.name).toBe('Premium Ebook')
      expect(delivery?.description).toBe('A comprehensive guide to digital marketing')
      expect(delivery?.download_limit).toBe(5)
      expect(delivery?.expiry_days).toBe(30)
      expect(Boolean(delivery?.requires_login)).toBe(true)
      expect(Boolean(delivery?.automatic_delivery)).toBe(true)
      expect(delivery?.status).toBe('active')
      expect(delivery?.uuid).toBeDefined()

      // Save the ID for further testing
      const deliveryId = delivery?.id !== undefined ? Number(delivery.id) : undefined

      // Verify we can fetch the delivery we just created
      if (deliveryId) {
        const fetchedDelivery = await fetchById(deliveryId)
        expect(fetchedDelivery).toBeDefined()
        expect(fetchedDelivery?.id).toBe(deliveryId)
      }
    })

    it('should create a delivery with minimal required fields', async () => {
      const minimalRequestData = {
        name: 'Basic PDF',
        description: 'A simple PDF document',
        expiry_days: 7,
        status: 'active',
      }

      const delivery = await store(minimalRequestData)

      expect(delivery).toBeDefined()
      expect(delivery?.name).toBe('Basic PDF')
      expect(delivery?.description).toBe('A simple PDF document')
      expect(delivery?.expiry_days).toBe(7)
      expect(delivery?.status).toBe('active')
      expect(delivery?.uuid).toBeDefined()
    })

    it('should create multiple digital deliveries with bulk store', async () => {
      const requests = [
        {
          name: 'Ebook 1',
          description: 'First ebook',
          expiry_days: 30,
          status: 'active',
        },
        {
          name: 'Ebook 2',
          description: 'Second ebook',
          expiry_days: 60,
          status: 'active',
        },
        {
          name: 'Ebook 3',
          description: 'Third ebook',
          expiry_days: 90,
          status: 'active',
        },
      ]

      const count = await bulkStore(requests as any)
      expect(count).toBe(3)

      // Verify deliveries can be fetched
      const allDeliveries = await fetchAll()
      expect(allDeliveries.length).toBeGreaterThanOrEqual(3)
    })

    it('should return 0 when trying to bulk store an empty array', async () => {
      const count = await bulkStore([])
      expect(count).toBe(0)
    })
  })

  describe('update', () => {
    it('should update an existing digital delivery', async () => {
      // First create a delivery to update
      const requestData = {
        name: 'Original Ebook',
        description: 'Original description',
        download_limit: 3,
        expiry_days: 30,
        requires_login: true,
        automatic_delivery: false,
        status: 'active',
      }

      // Create the delivery
      const delivery = await store(requestData)
      const deliveryId = delivery?.id !== undefined ? Number(delivery.id) : undefined

      // Make sure we have a valid delivery ID before proceeding
      expect(deliveryId).toBeDefined()
      if (!deliveryId) {
        throw new Error('Failed to create test digital delivery')
      }

      // Update the delivery with new data
      const updateData = {
        name: 'Updated Ebook',
        description: 'Updated description',
        download_limit: 5,
        expiry_days: 60,
        requires_login: false,
        automatic_delivery: true,
        status: 'inactive',
      }

      const updatedDelivery = await update(deliveryId, updateData)

      // Verify the update was successful
      expect(updatedDelivery).toBeDefined()
      expect(updatedDelivery?.id).toBe(deliveryId)
      expect(updatedDelivery?.name).toBe('Updated Ebook')
      expect(updatedDelivery?.description).toBe('Updated description')
      expect(updatedDelivery?.download_limit).toBe(5)
      expect(updatedDelivery?.expiry_days).toBe(60)
      expect(Boolean(updatedDelivery?.requires_login)).toBe(false)
      expect(Boolean(updatedDelivery?.automatic_delivery)).toBe(true)
      expect(updatedDelivery?.status).toBe('inactive')
    })

    it('should update a digital delivery\'s status', async () => {
      // Create a delivery
      const requestData = {
        name: 'Status Test Ebook',
        description: 'Test description',
        expiry_days: 30,
        status: 'active',
      }

      const delivery = await store(requestData)
      const deliveryId = delivery?.id !== undefined ? Number(delivery.id) : undefined

      // Make sure we have a valid delivery ID before proceeding
      expect(deliveryId).toBeDefined()
      if (!deliveryId) {
        throw new Error('Failed to create test digital delivery')
      }

      // Update status to inactive
      const updatedDelivery = await updateStatus(deliveryId, 'inactive')
      expect(updatedDelivery).toBeDefined()
      expect(updatedDelivery?.status).toBe('inactive')

      // Update status back to active
      const reactivatedDelivery = await updateStatus(deliveryId, 'active')
      expect(reactivatedDelivery).toBeDefined()
      expect(reactivatedDelivery?.status).toBe('active')
    })

    it('should update delivery settings', async () => {
      // Create a delivery
      const requestData = {
        name: 'Settings Test Ebook',
        description: 'Test description',
        download_limit: 3,
        expiry_days: 30,
        requires_login: true,
        automatic_delivery: false,
        status: 'active',
      }

      const delivery = await store(requestData)
      const deliveryId = delivery?.id !== undefined ? Number(delivery.id) : undefined

      expect(deliveryId).toBeDefined()
      if (!deliveryId) {
        throw new Error('Failed to create test digital delivery')
      }

      // Update settings
      const updatedDelivery = await updateDeliverySettings(
        deliveryId,
        5, // new download limit
        60, // new expiry days
        false, // new requires_login
        true, // new automatic_delivery
      )

      expect(updatedDelivery).toBeDefined()
      expect(updatedDelivery?.download_limit).toBe(5)
      expect(updatedDelivery?.expiry_days).toBe(60)
      expect(Boolean(updatedDelivery?.requires_login)).toBe(false)
      expect(Boolean(updatedDelivery?.automatic_delivery)).toBe(true)
    })

    it('should update only provided delivery settings', async () => {
      // Create a delivery
      const requestData = {
        name: 'Partial Update Ebook',
        description: 'Test description',
        download_limit: 3,
        expiry_days: 30,
        requires_login: true,
        automatic_delivery: false,
        status: 'active',
      }

      const delivery = await store(requestData)
      const deliveryId = delivery?.id !== undefined ? Number(delivery.id) : undefined

      expect(deliveryId).toBeDefined()
      if (!deliveryId) {
        throw new Error('Failed to create test digital delivery')
      }

      // Update only download limit and expiry days
      const updatedDelivery = await updateDeliverySettings(
        deliveryId,
        5, // new download limit
        60, // new expiry days
      )

      expect(updatedDelivery).toBeDefined()
      expect(updatedDelivery?.download_limit).toBe(5)
      expect(updatedDelivery?.expiry_days).toBe(60)
      expect(Boolean(updatedDelivery?.requires_login)).toBe(true) // Should remain unchanged
      expect(Boolean(updatedDelivery?.automatic_delivery)).toBe(false) // Should remain unchanged
    })
  })

  describe('destroy', () => {
    it('should delete a digital delivery from the database', async () => {
      // First create a delivery to delete
      const requestData = {
        name: 'Delivery to Delete',
        description: 'Test description',
        expiry_days: 30,
        status: 'active',
      }

      // Create the delivery
      const delivery = await store(requestData)
      const deliveryId = delivery?.id !== undefined ? Number(delivery.id) : undefined

      // Make sure we have a valid delivery ID before proceeding
      expect(deliveryId).toBeDefined()
      if (!deliveryId) {
        throw new Error('Failed to create test digital delivery')
      }

      // Verify the delivery exists
      let fetchedDelivery = await fetchById(deliveryId)
      expect(fetchedDelivery).toBeDefined()

      // Delete the delivery
      const result = await destroy(deliveryId)
      expect(result).toBe(true)

      // Verify the delivery no longer exists
      fetchedDelivery = await fetchById(deliveryId)
      expect(fetchedDelivery).toBeUndefined()
    })

    it('should soft delete a digital delivery', async () => {
      // Create a delivery
      const requestData = {
        name: 'Delivery to Soft Delete',
        description: 'Test description',
        expiry_days: 30,
        status: 'active',
      }

      // Create the delivery
      const delivery = await store(requestData)
      const deliveryId = delivery?.id !== undefined ? Number(delivery.id) : undefined

      expect(deliveryId).toBeDefined()
      if (!deliveryId) {
        throw new Error('Failed to create test digital delivery')
      }

      // Soft delete the delivery
      const result = await softDelete(deliveryId)
      expect(result).toBe(true)

      // Verify the delivery still exists but is inactive
      const fetchedDelivery = await fetchById(deliveryId)
      expect(fetchedDelivery).toBeDefined()
      expect(fetchedDelivery?.status).toBe('inactive')
    })

    it('should delete multiple digital deliveries from the database', async () => {
      // Create several deliveries to delete
      const deliveryIds = []

      // Create 3 test deliveries
      for (let i = 0; i < 3; i++) {
        const requestData = {
          name: `Bulk Delete Delivery ${i}`,
          description: `Test description ${i}`,
          expiry_days: 30,
          status: 'active',
        }

        const delivery = await store(requestData)

        const deliveryId = delivery?.id !== undefined ? Number(delivery.id) : undefined
        expect(deliveryId).toBeDefined()

        if (deliveryId) {
          deliveryIds.push(deliveryId)
        }
      }

      // Ensure we have created the deliveries
      expect(deliveryIds.length).toBe(3)

      // Delete the deliveries
      const deletedCount = await bulkDestroy(deliveryIds)
      expect(deletedCount).toBe(3)

      // Verify the deliveries no longer exist
      for (const id of deliveryIds) {
        const fetchedDelivery = await fetchById(id)
        expect(fetchedDelivery).toBeUndefined()
      }
    })

    it('should soft delete multiple digital deliveries', async () => {
      // Create several deliveries to soft delete
      const deliveryIds = []

      // Create 3 test deliveries
      for (let i = 0; i < 3; i++) {
        const requestData = {
          name: `Bulk Soft Delete Delivery ${i}`,
          description: `Test description ${i}`,
          expiry_days: 30,
          status: 'active',
        }

        const delivery = await store(requestData)

        const deliveryId = delivery?.id !== undefined ? Number(delivery.id) : undefined
        expect(deliveryId).toBeDefined()

        if (deliveryId) {
          deliveryIds.push(deliveryId)
        }
      }

      // Ensure we have created the deliveries
      expect(deliveryIds.length).toBe(3)

      // Soft delete the deliveries
      const deletedCount = await bulkSoftDelete(deliveryIds)
      expect(deletedCount).toBe(3)

      // Verify the deliveries still exist but are inactive
      for (const id of deliveryIds) {
        const fetchedDelivery = await fetchById(id)
        expect(fetchedDelivery).toBeDefined()
        expect(fetchedDelivery?.status).toBe('inactive')
      }
    })

    it('should return 0 when trying to delete an empty array of deliveries', async () => {
      // Try to delete with an empty array
      const deletedCount = await bulkDestroy([])
      expect(deletedCount).toBe(0)
    })

    it('should return 0 when trying to soft delete an empty array of deliveries', async () => {
      // Try to soft delete with an empty array
      const deletedCount = await bulkSoftDelete([])
      expect(deletedCount).toBe(0)
    })
  })
})
