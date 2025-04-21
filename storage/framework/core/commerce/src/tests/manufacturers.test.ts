import { beforeEach, describe, expect, it } from 'bun:test'
import { refreshDatabase } from '@stacksjs/testing'
import { bulkDestroy, destroy } from '../products/manufacturers/destroy'
import { fetchByCountry, fetchById, fetchFeatured, fetchWithProductCount } from '../products/manufacturers/fetch'
import { bulkStore, store } from '../products/manufacturers/store'
import { update, updateFeaturedStatus } from '../products/manufacturers/update'

beforeEach(async () => {
  await refreshDatabase()
})

describe('Manufacturer Module', () => {
  describe('store', () => {
    it('should create a new manufacturer in the database', async () => {
      const manufacturerName = `Test Manufacturer ${Date.now()}`

      const requestData = {
        manufacturer: manufacturerName,
        description: 'Test description',
        country: 'USA',
        featured: true,
      }

      const manufacturer = await store(requestData)

      expect(manufacturer).toBeDefined()
      expect(manufacturer?.manufacturer).toBe(manufacturerName)
      expect(manufacturer?.description).toBe('Test description')
      expect(manufacturer?.country).toBe('USA')
      expect(Boolean(manufacturer?.featured)).toBe(true)

      // Save the ID and convert from Generated<number> to number
      const manufacturerId = manufacturer?.id !== undefined ? Number(manufacturer.id) : undefined

      // Verify we can fetch the manufacturer we just created
      if (manufacturerId) {
        const fetchedManufacturer = await fetchById(manufacturerId)
        expect(fetchedManufacturer).toBeDefined()
        expect(fetchedManufacturer?.id).toBe(manufacturerId)
      }
    })

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

    it('should create a manufacturer with default values when optional fields are missing', async () => {
      // Create a manufacturer with only required fields
      const manufacturerName = `Minimal Manufacturer ${Date.now()}`

      const minimalRequestData = {
        manufacturer: manufacturerName,
        country: 'Germany',
        // Other fields are omitted to test defaults
      }

      const manufacturer = await store(minimalRequestData)

      expect(manufacturer).toBeDefined()
      expect(manufacturer?.manufacturer).toBe(manufacturerName)
      expect(manufacturer?.country).toBe('Germany')
      expect(Boolean(manufacturer?.featured)).toBe(false) // Default value
    })
  })

  describe('bulkStore', () => {
    it('should create multiple manufacturers at once', async () => {
      const baseTime = Date.now()
      const requests = [
        {
          manufacturer: `Bulk Manufacturer 1 ${baseTime}`,
          description: 'Description 1',
          country: 'Japan',
        },
        {
          manufacturer: `Bulk Manufacturer 2 ${baseTime}`,
          description: 'Description 2',
          country: 'China',
          featured: true,
        },
        {
          manufacturer: `Bulk Manufacturer 3 ${baseTime}`,
          description: 'Description 3',
          country: 'Korea',
        },
      ]

      const createdCount = await bulkStore(requests as any)
      expect(createdCount).toBe(3)

      // Verify the last manufacturer was created
      const manufacturers = await fetchByCountry('Korea')
      expect(manufacturers.data.some(m => m.manufacturer === `Bulk Manufacturer 3 ${baseTime}`)).toBe(true)
    })

    it('should return 0 when trying to create with an empty array', async () => {
      const createdCount = await bulkStore([])
      expect(createdCount).toBe(0)
    })
  })

  describe('fetch methods', () => {
    it('should fetch a manufacturer by ID', async () => {
      // First create a manufacturer to fetch
      const manufacturerName = `FetchByID Manufacturer ${Date.now()}`
      const requestData = {
        manufacturer: manufacturerName,
        description: 'Test fetch by ID',
        country: 'France',
      }

      const manufacturer = await store(requestData)
      const manufacturerId = manufacturer?.id !== undefined ? Number(manufacturer.id) : undefined

      // Make sure we have a valid manufacturer ID before proceeding
      expect(manufacturerId).toBeDefined()
      if (!manufacturerId) {
        throw new Error('Failed to create test manufacturer')
      }

      // Now fetch the manufacturer by ID
      const fetchedManufacturer = await fetchById(manufacturerId)

      expect(fetchedManufacturer).toBeDefined()
      expect(fetchedManufacturer?.id).toBe(manufacturerId)
      expect(fetchedManufacturer?.manufacturer).toBe(manufacturerName)
      expect(fetchedManufacturer?.description).toBe('Test fetch by ID')
      expect(fetchedManufacturer?.country).toBe('France')
    })

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

    it('should fetch manufacturers by country with pagination', async () => {
      // Create manufacturers from the same country
      const baseTime = Date.now()
      const country = 'Brazil'
      const brazilianManufacturers = [
        `Brazilian Manufacturer 1 ${baseTime}`,
        `Brazilian Manufacturer 2 ${baseTime}`,
        `Brazilian Manufacturer 3 ${baseTime}`,
      ]

      for (const name of brazilianManufacturers) {
        const requestData = {
          manufacturer: name,
          description: 'Brazilian description',
          country,
        }
        await store(requestData)
      }

      // Create a manufacturer from a different country
      const otherRequest = {
        manufacturer: `Non-Brazilian Manufacturer ${baseTime}`,
        description: 'Other description',
        country: 'Argentina',
      }
      await store(otherRequest)

      // Fetch manufacturers from Brazil with pagination (limit 2)
      const result = await fetchByCountry(country)

      // Verify pagination info
      expect(result.data.length).toBeLessThanOrEqual(2)
      expect(result.paging.total_records).toBeGreaterThanOrEqual(3)
      expect(result.paging.page).toBe(1)
      expect(result.paging.total_pages).toBeGreaterThanOrEqual(2)
      expect(result.next_cursor).toBe(2)

      // Fetch the second page
      const page2 = await fetchByCountry(country)
      expect(page2.data.length).toBeGreaterThanOrEqual(1)
      expect(page2.paging.page).toBe(2)
    })

    it('should fetch manufacturers with product count', async () => {
      // For this test, we can't easily add products, but we can test the pagination
      // and filtering functionality of fetchWithProductCount

      // Create manufacturers with different featured statuses
      const baseTime = Date.now()
      const requestData1 = {
        manufacturer: `ProductCount Manufacturer 1 ${baseTime}`,
        description: 'Featured',
        country: 'Canada',
        featured: true,
      }

      const requestData2 = {
        manufacturer: `ProductCount Manufacturer 2 ${baseTime}`,
        description: 'Not featured',
        country: 'Canada',
        featured: false,
      }

      await store(requestData1)
      await store(requestData2)

      // Fetch manufacturers with product count, filtered by featured status
      const featuredResults = await fetchWithProductCount({ featured: true })
      const nonFeaturedResults = await fetchWithProductCount({ featured: false })

      // Verify our test manufacturers are in the appropriate result sets
      expect(featuredResults.some(m =>
        m.manufacturer === `ProductCount Manufacturer 1 ${baseTime}`,
      )).toBe(true)

      expect(nonFeaturedResults.some(m =>
        m.manufacturer === `ProductCount Manufacturer 2 ${baseTime}`,
      )).toBe(true)
    })
  })

  describe('update', () => {
    it('should update an existing manufacturer', async () => {
      // First create a manufacturer to update
      const manufacturerName = `Update Manufacturer ${Date.now()}`
      const initialData = {
        manufacturer: manufacturerName,
        description: 'Initial description',
        country: 'Mexico',
        featured: false,
      }

      // Create the manufacturer
      const manufacturer = await store(initialData)
      const manufacturerId = manufacturer?.id !== undefined ? Number(manufacturer.id) : undefined

      // Make sure we have a valid manufacturer ID before proceeding
      expect(manufacturerId).toBeDefined()
      if (!manufacturerId) {
        throw new Error('Failed to create test manufacturer')
      }

      // Update the manufacturer with new data
      const updateData = {
        description: 'Updated description',
        country: 'Australia',
        featured: true,
      }

      const updatedManufacturer = await update(manufacturerId, updateData)

      // Verify the update was successful
      expect(updatedManufacturer).toBeDefined()
      expect(updatedManufacturer?.id).toBe(manufacturerId)
      expect(updatedManufacturer?.description).toBe('Updated description')
      expect(updatedManufacturer?.country).toBe('Australia')
      expect(Boolean(updatedManufacturer?.featured)).toBe(true)

      // The original name should remain unchanged
      expect(updatedManufacturer?.manufacturer).toBe(manufacturerName)
    })

    it('should throw an error when trying to update a manufacturer with an existing name', async () => {
      // Create two manufacturers with unique names
      const name1 = `Update Conflict 1 ${Date.now()}`
      const name2 = `Update Conflict 2 ${Date.now()}`

      // Create first manufacturer
      const firstManufacturerData = {
        manufacturer: name1,
        description: 'First test description',
        country: 'UK',
      }

      const firstManufacturer = await store(firstManufacturerData)
      const firstManufacturerId = firstManufacturer?.id !== undefined ? Number(firstManufacturer.id) : undefined
      expect(firstManufacturerId).toBeDefined()

      // Create second manufacturer
      const secondManufacturerData = {
        manufacturer: name2,
        description: 'Second test description',
        country: 'UK',
      }

      const secondManufacturer = await store(secondManufacturerData)
      const secondManufacturerId = secondManufacturer?.id !== undefined ? Number(secondManufacturer.id) : undefined
      expect(secondManufacturerId).toBeDefined()

      if (!firstManufacturerId || !secondManufacturerId)
        throw new Error('Failed to create test manufacturers')

      // Try to update the second manufacturer with the first manufacturer's name
      const updateData = {
        manufacturer: name1, // This should conflict with the first manufacturer
      }

      try {
        await update(secondManufacturerId, updateData)
        // If we get here, the test should fail as we expect an error
        expect(true).toBe(false) // This line should not be reached
      }
      catch (error) {
        expect(error).toBeDefined()
        expect(error instanceof Error).toBe(true)
        // Check for both possible error message formats
        const errorMessage = (error as Error).message
        expect(
          errorMessage.includes('A manufacturer with this name already exists')
          || errorMessage.includes('Duplicate entry')
          || errorMessage.includes('Failed to update manufacturer'),
        ).toBe(true)
      }
    })

    it('should throw an error when trying to update a non-existent manufacturer', async () => {
      // Use a non-existent ID
      const nonExistentId = 99999999

      const updateData = {
        description: 'This update should fail',
      }

      try {
        await update(nonExistentId, updateData)
        // If we get here, the test should fail as we expect an error
        expect(true).toBe(false) // This line should not be reached
      }
      catch (error) {
        expect(error).toBeDefined()
        expect(error instanceof Error).toBe(true)
        expect((error as Error).message).toContain(`Manufacturer with ID ${nonExistentId} not found`)
      }
    })
  })

  describe('updateFeaturedStatus', () => {
    it('should update a manufacturer featured status', async () => {
      // Create a manufacturer with featured = false
      const manufacturerName = `Featured Status Test ${Date.now()}`
      const requestData = {
        manufacturer: manufacturerName,
        description: 'Test featured status update',
        country: 'India',
        featured: false,
      }

      const manufacturer = await store(requestData)
      const manufacturerId = manufacturer?.id !== undefined ? Number(manufacturer.id) : undefined

      // Make sure we have a valid manufacturer ID before proceeding
      expect(manufacturerId).toBeDefined()
      if (!manufacturerId) {
        throw new Error('Failed to create test manufacturer')
      }

      // Update the featured status to true
      const updatedManufacturer = await updateFeaturedStatus(manufacturerId, true)

      // Verify the update was successful
      expect(updatedManufacturer).toBeDefined()
      expect(updatedManufacturer?.id).toBe(manufacturerId)
      expect(Boolean(updatedManufacturer?.featured)).toBe(true)

      // Test toggling without specifying a value
      const toggledManufacturer = await updateFeaturedStatus(manufacturerId)
      expect(Boolean(toggledManufacturer?.featured)).toBe(false) // Should toggle back to false
    })
  })

  describe('destroy', () => {
    it('should delete a manufacturer from the database', async () => {
      // First create a manufacturer to delete
      const manufacturerName = `Delete Test ${Date.now()}`
      const requestData = {
        manufacturer: manufacturerName,
        description: 'Test deletion',
        country: 'South Africa',
      }

      // Create the manufacturer
      const manufacturer = await store(requestData)
      const manufacturerId = manufacturer?.id !== undefined ? Number(manufacturer.id) : undefined

      // Make sure we have a valid manufacturer ID before proceeding
      expect(manufacturerId).toBeDefined()
      if (!manufacturerId) {
        throw new Error('Failed to create test manufacturer')
      }

      // Verify the manufacturer exists
      let fetchedManufacturer = await fetchById(manufacturerId)
      expect(fetchedManufacturer).toBeDefined()

      // Delete the manufacturer
      const result = await destroy(manufacturerId)
      expect(result).toBe(true)

      // Verify the manufacturer no longer exists
      fetchedManufacturer = await fetchById(manufacturerId)
      expect(fetchedManufacturer).toBeUndefined()
    })
  })

  describe('bulkDestroy', () => {
    it('should delete multiple manufacturers from the database', async () => {
      // Create multiple manufacturers to delete
      const manufacturers = []
      const manufacturerIds = []

      // Create 3 test manufacturers
      const baseTime = Date.now()
      for (let i = 0; i < 3; i++) {
        const manufacturerName = `Bulk Delete ${i} ${baseTime}`
        const requestData = {
          manufacturer: manufacturerName,
          description: `Bulk deletion test ${i}`,
          country: 'Egypt',
        }

        const manufacturer = await store(requestData)
        expect(manufacturer).toBeDefined()

        const manufacturerId = manufacturer?.id !== undefined ? Number(manufacturer.id) : undefined
        expect(manufacturerId).toBeDefined()

        if (manufacturerId) {
          manufacturerIds.push(manufacturerId)
          manufacturers.push(manufacturer)
        }
      }

      // Ensure we have created the manufacturers
      expect(manufacturerIds.length).toBe(3)

      // Delete the manufacturers
      const deletedCount = await bulkDestroy(manufacturerIds)
      expect(deletedCount).toBe(3)

      // Verify the manufacturers no longer exist
      for (const id of manufacturerIds) {
        const fetchedManufacturer = await fetchById(id)
        expect(fetchedManufacturer).toBeUndefined()
      }
    })

    it('should return 0 when trying to delete an empty array of manufacturers', async () => {
      // Try to delete with an empty array
      const deletedCount = await bulkDestroy([])
      expect(deletedCount).toBe(0)
    })
  })
})
