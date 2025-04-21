import { beforeEach, describe, expect, it } from 'bun:test'
import { refreshDatabase } from '@stacksjs/testing'
import { bulkDestroy, destroy } from '../tax/destroy'
import { fetchAll, fetchById } from '../tax/fetch'
import { bulkStore, store } from '../tax/store'
import { update, updateRate, updateStatus } from '../tax/update'

beforeEach(async () => {
  await refreshDatabase()
})

describe('Tax Rate Module', () => {
  describe('store', () => {
    it('should create a new tax rate in the database', async () => {
      const requestData = {
        name: 'Standard VAT',
        rate: 20,
        type: 'VAT',
        country: 'United Kingdom',
        region: 'Europe',
        status: 'active',
        is_default: true,
      }

      const taxRate = await store(requestData)

      expect(taxRate).toBeDefined()
      expect(taxRate?.name).toBe('Standard VAT')
      expect(taxRate?.rate).toBe(20)
      expect(taxRate?.type).toBe('VAT')
      expect(taxRate?.country).toBe('United Kingdom')
      expect(taxRate?.region).toBe('Europe')
      expect(taxRate?.status).toBe('active')
      expect(Boolean(taxRate?.is_default)).toBe(true)
      expect(taxRate?.uuid).toBeDefined()

      // Save the ID for further testing
      const taxRateId = taxRate?.id !== undefined ? Number(taxRate.id) : undefined

      // Verify we can fetch the tax rate we just created
      if (taxRateId) {
        const fetchedTaxRate = await fetchById(taxRateId)
        expect(fetchedTaxRate).toBeDefined()
        expect(fetchedTaxRate?.id).toBe(taxRateId)
      }
    })

    it('should create a tax rate with minimal required fields', async () => {
      const minimalRequestData = {
        name: 'Basic Tax',
        rate: 10,
        type: 'Sales Tax',
        country: 'United States',
        region: 'North America',
      }

      const taxRate = await store(minimalRequestData)

      expect(taxRate).toBeDefined()
      expect(taxRate?.name).toBe('Basic Tax')
      expect(taxRate?.rate).toBe(10)
      expect(taxRate?.type).toBe('Sales Tax')
      expect(taxRate?.country).toBe('United States')
      expect(taxRate?.region).toBe('North America')
      expect(taxRate?.status).toBe('active') // Default value
      expect(Boolean(taxRate?.is_default)).toBe(false) // Default value
      expect(taxRate?.uuid).toBeDefined()
    })

    it('should create multiple tax rates with bulk store', async () => {
      const requests = [
        {
          name: 'Standard VAT',
          rate: 20,
          type: 'VAT',
          country: 'United Kingdom',
          region: 'Europe',
          status: 'active',
          is_default: true,
        },
        {
          name: 'GST',
          rate: 10,
          type: 'GST',
          country: 'Australia',
          region: 'Oceania',
          status: 'active',
          is_default: false,
        },
        {
          name: 'Sales Tax',
          rate: 8.875,
          type: 'Sales Tax',
          country: 'United States',
          region: 'North America',
          status: 'active',
          is_default: false,
        },
      ]

      const count = await bulkStore(requests)
      expect(count).toBe(3)

      // Verify tax rates can be fetched
      const allTaxRates = await fetchAll()
      expect(allTaxRates.length).toBeGreaterThanOrEqual(3)
    })

    it('should return 0 when trying to bulk store an empty array', async () => {
      const count = await bulkStore([])
      expect(count).toBe(0)
    })
  })

  describe('update', () => {
    it('should update an existing tax rate', async () => {
      // First create a tax rate to update
      const requestData = {
        name: 'Standard VAT',
        rate: 20,
        type: 'VAT',
        country: 'United Kingdom',
        region: 'Europe',
        status: 'active',
        is_default: true,
      }

      // Create the tax rate
      const taxRate = await store(requestData)
      const taxRateId = taxRate?.id !== undefined ? Number(taxRate.id) : undefined

      // Make sure we have a valid tax rate ID before proceeding
      expect(taxRateId).toBeDefined()
      if (!taxRateId) {
        throw new Error('Failed to create test tax rate')
      }

      const updateData = {
        name: 'Reduced VAT',
        rate: 5,
        type: 'VAT',
        country: 'United Kingdom',
        region: 'Europe',
        status: 'active',
        is_default: false,
      }

      const updatedTaxRate = await update(taxRateId, updateData)

      // Verify the update was successful
      expect(updatedTaxRate).toBeDefined()
      expect(updatedTaxRate?.id).toBe(taxRateId)
      expect(updatedTaxRate?.name).toBe('Reduced VAT')
      expect(updatedTaxRate?.rate).toBe(5)
      expect(updatedTaxRate?.type).toBe('VAT')
      expect(updatedTaxRate?.country).toBe('United Kingdom')
      expect(updatedTaxRate?.region).toBe('Europe')
      expect(updatedTaxRate?.status).toBe('active')
      expect(Boolean(updatedTaxRate?.is_default)).toBe(false)
    })

    it('should update a tax rate\'s status', async () => {
      // Create a tax rate
      const requestData = {
        name: 'Standard VAT',
        rate: 20,
        type: 'VAT',
        country: 'United Kingdom',
        region: 'Europe',
        status: 'active',
        is_default: true,
      }

      const taxRate = await store(requestData)
      const taxRateId = taxRate?.id !== undefined ? Number(taxRate.id) : undefined

      // Make sure we have a valid tax rate ID before proceeding
      expect(taxRateId).toBeDefined()
      if (!taxRateId) {
        throw new Error('Failed to create test tax rate')
      }

      // Update status to inactive
      const updatedTaxRate = await updateStatus(taxRateId, 'inactive')
      expect(updatedTaxRate).toBeDefined()
      expect(updatedTaxRate?.status).toBe('inactive')

      // Update status back to active
      const reactivatedTaxRate = await updateStatus(taxRateId, 'active')
      expect(reactivatedTaxRate).toBeDefined()
      expect(reactivatedTaxRate?.status).toBe('active')
    })

    it('should update rate information', async () => {
      // Create a tax rate
      const requestData = {
        name: 'Standard VAT',
        rate: 20,
        type: 'VAT',
        country: 'United Kingdom',
        region: 'Europe',
        status: 'active',
        is_default: true,
      }

      const taxRate = await store(requestData)
      const taxRateId = taxRate?.id !== undefined ? Number(taxRate.id) : undefined

      expect(taxRateId).toBeDefined()
      if (!taxRateId) {
        throw new Error('Failed to create test tax rate')
      }

      // Update rate
      const updatedTaxRate = await updateRate(taxRateId, 25)

      expect(updatedTaxRate).toBeDefined()
      expect(updatedTaxRate?.rate).toBe(25)
    })
  })

  describe('destroy', () => {
    it('should delete a tax rate from the database', async () => {
      // First create a tax rate to delete
      const requestData = {
        name: 'Standard VAT',
        rate: 20,
        type: 'VAT',
        country: 'United Kingdom',
        region: 'Europe',
        status: 'active',
        is_default: true,
      }

      // Create the tax rate
      const taxRate = await store(requestData)
      const taxRateId = taxRate?.id !== undefined ? Number(taxRate.id) : undefined

      // Make sure we have a valid tax rate ID before proceeding
      expect(taxRateId).toBeDefined()
      if (!taxRateId) {
        throw new Error('Failed to create test tax rate')
      }

      // Verify the tax rate exists
      let fetchedTaxRate = await fetchById(taxRateId)
      expect(fetchedTaxRate).toBeDefined()

      // Delete the tax rate
      const result = await destroy(taxRateId)
      expect(result).toBe(true)

      // Verify the tax rate no longer exists
      fetchedTaxRate = await fetchById(taxRateId)
      expect(fetchedTaxRate).toBeUndefined()
    })

    it('should delete multiple tax rates from the database', async () => {
      // Create several tax rates to delete
      const taxRateIds = []

      // Create 3 test tax rates
      for (let i = 0; i < 3; i++) {
        const requestData = {
          name: `Tax Rate ${i}`,
          rate: 20 + i,
          type: 'VAT',
          country: 'United Kingdom',
          region: 'Europe',
          status: 'active',
          is_default: false,
        }

        const taxRate = await store(requestData)

        const taxRateId = taxRate?.id !== undefined ? Number(taxRate.id) : undefined
        expect(taxRateId).toBeDefined()

        if (taxRateId) {
          taxRateIds.push(taxRateId)
        }
      }

      // Ensure we have created the tax rates
      expect(taxRateIds.length).toBe(3)

      // Delete the tax rates
      const deletedCount = await bulkDestroy(taxRateIds)
      expect(deletedCount).toBe(3)

      // Verify the tax rates no longer exist
      for (const id of taxRateIds) {
        const fetchedTaxRate = await fetchById(id)
        expect(fetchedTaxRate).toBeUndefined()
      }
    })

    it('should return 0 when trying to delete an empty array of tax rates', async () => {
      // Try to delete with an empty array
      const deletedCount = await bulkDestroy([])
      expect(deletedCount).toBe(0)
    })
  })
})
