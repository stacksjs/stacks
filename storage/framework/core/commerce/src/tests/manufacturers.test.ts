import { beforeEach, describe, expect, it } from 'bun:test'
import { refreshDatabase } from '@stacksjs/testing'
import { bulkDestroy } from '../products/manufacturers/destroy'
import { fetchFeatured } from '../products/manufacturers/fetch'
import { bulkStore, store } from '../products/manufacturers/store'

beforeEach(async () => {
  await refreshDatabase()
})

describe('Manufacturer Module', () => {
  describe('store', () => {
    it('should throw an error when trying to create a manufacturer with a duplicate name', async () => {
      // Create a unique name to avoid conflicts with other tests
      const manufacturerName = `Duplicate Manufacturer ${Date.now()}`

      // Create first manufacturer
      const firstManufacturerData = {
        manufacturer: manufacturerName,
        description: 'First test description',
        country: 'USA',
      }

      const firstManufacturer = await store(firstManufacturerData)
      expect(firstManufacturer).toBeDefined()

      // Try to create a second manufacturer with the same name
      const secondManufacturerData = {
        manufacturer: manufacturerName, // Same name as the first manufacturer
        description: 'Second test description',
        country: 'Canada',
      }

      try {
        await store(secondManufacturerData)
        // If we get here, the test should fail as we expect an error
        expect(true).toBe(false) // This line should not be reached
      }
      catch (error) {
        expect(error).toBeDefined()
        expect(error instanceof Error).toBe(true)
        // Check for the specific error message format
        const errorMessage = (error as Error).message
        expect(
          errorMessage.includes('Failed to create manufacturer: UNIQUE constraint failed: manufacturers.manufacturer'),
        ).toBe(true)
      }
    })
  })

  describe('bulkStore', () => {
    it('should return 0 when trying to create with an empty array', async () => {
      const createdCount = await bulkStore([])
      expect(createdCount).toBe(0)
    })
  })

  describe('fetch methods', () => {
    it('should fetch featured manufacturers', async () => {
      // Create some featured manufacturers
      const baseTime = Date.now()
      const featuredNames = [
        `Featured Manufacturer 1 ${baseTime}`,
        `Featured Manufacturer 2 ${baseTime}`,
      ]

      for (const name of featuredNames) {
        const requestData = {
          manufacturer: name,
          description: 'Featured description',
          country: 'Spain',
          featured: true,
        }
        await store(requestData)
      }

      // Create a non-featured manufacturer
      const nonFeaturedRequest = {
        manufacturer: `Non-Featured Manufacturer ${baseTime}`,
        description: 'Non-featured description',
        country: 'Spain',
        featured: false,
      }
      await store(nonFeaturedRequest)

      // Fetch featured manufacturers
      const featuredManufacturers = await fetchFeatured(5)

      // Verify our featured manufacturers are in the results
      for (const name of featuredNames) {
        expect(featuredManufacturers.some(m => m.manufacturer === name)).toBe(true)
      }

      // Verify the non-featured manufacturer is not in the results
      expect(featuredManufacturers.some(m => m.manufacturer === `Non-Featured Manufacturer ${baseTime}`)).toBe(false)
    })
  })

  describe('bulkDestroy', () => {
    it('should return 0 when trying to delete an empty array of manufacturers', async () => {
      // Try to delete with an empty array
      const deletedCount = await bulkDestroy([])
      expect(deletedCount).toBe(0)
    })
  })
})
