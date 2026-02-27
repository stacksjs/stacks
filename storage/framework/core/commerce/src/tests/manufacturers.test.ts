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
    it('should create a manufacturer successfully', async () => {
      const data = {
        manufacturer: `Test Manufacturer ${Date.now()}`,
        description: 'Test description',
        country: 'USA',
      }

      const result = await store(data)
      expect(result).toBeDefined()
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
