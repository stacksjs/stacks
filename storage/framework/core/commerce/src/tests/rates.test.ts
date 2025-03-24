import { beforeEach, describe, expect, it } from 'bun:test'
import { refreshDatabase } from '@stacksjs/testing'
import { bulkDestroy, destroy, destroyByMethod, destroyByZone } from '../rates/destroy'
import { fetchById, formatShippingRateOptions, getRateByWeightAndZone, getRatesByZone, getShippingRatesByMethod } from '../rates/fetch'
import { bulkStore, store } from '../rates/store'
import { bulkUpdate, update, updateByMethod, updateByZone } from '../rates/update'

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

describe('Shipping Rate Module', () => {
  describe('store', () => {
    it('should create a new shipping rate in the database', async () => {
      const requestData = {
        method: 'Standard Shipping',
        zone: 'US',
        weight_from: 0,
        weight_to: 10,
        rate: 1500, // $15.00
      }

      const request = new TestRequest(requestData)
      const rate = await store(request as any)

      expect(rate).toBeDefined()
      expect(rate?.method).toBe('Standard Shipping')
      expect(rate?.zone).toBe('US')
      expect(rate?.weight_from).toBe(0)
      expect(rate?.weight_to).toBe(10)
      expect(rate?.rate).toBe(1500)
      expect(rate?.uuid).toBeDefined()

      // Save the ID for further testing
      const rateId = rate?.id !== undefined ? Number(rate.id) : undefined

      // Verify we can fetch the rate we just created
      if (rateId) {
        const fetchedRate = await fetchById(rateId)
        expect(fetchedRate).toBeDefined()
        expect(fetchedRate?.id).toBe(rateId)
      }
    })

    it('should create multiple shipping rates with bulk store', async () => {
      const requests = [
        new TestRequest({
          method: 'Standard',
          zone: 'US',
          weight_from: 0,
          weight_to: 5,
          rate: 1000,
        }),
        new TestRequest({
          method: 'Express',
          zone: 'US',
          weight_from: 0,
          weight_to: 5,
          rate: 2000,
        }),
        new TestRequest({
          method: 'Standard',
          zone: 'CA',
          weight_from: 0,
          weight_to: 5,
          rate: 1500,
        }),
      ]

      const count = await bulkStore(requests as any)
      expect(count).toBe(3)

      // Verify rates can be found by zone
      const usRates = await getRatesByZone('US')
      expect(usRates.length).toBe(2)
      expect(usRates[0].zone).toBe('US')

      // Verify rates can be found by method
      const standardRates = await getShippingRatesByMethod('Standard')
      expect(standardRates.length).toBe(2)
      expect(standardRates[0].method).toBe('Standard')
    })

    it('should return 0 when trying to bulk store an empty array', async () => {
      const count = await bulkStore([])
      expect(count).toBe(0)
    })
  })

  describe('fetch', () => {
    it('should get shipping rates by zone', async () => {
      // Create test rates
      await store(new TestRequest({
        method: 'Standard',
        zone: 'US',
        weight_from: 0,
        weight_to: 5,
        rate: 1000,
      }) as any)

      await store(new TestRequest({
        method: 'Express',
        zone: 'US',
        weight_from: 0,
        weight_to: 5,
        rate: 2000,
      }) as any)

      const rates = await getRatesByZone('US')
      expect(rates.length).toBe(2)
      expect(rates[0].zone).toBe('US')
      expect(rates[1].zone).toBe('US')
    })

    it('should get shipping rate by weight and zone', async () => {
      await store(new TestRequest({
        method: 'Standard',
        zone: 'US',
        weight_from: 0,
        weight_to: 5,
        rate: 1000,
      }) as any)

      const rate = await getRateByWeightAndZone(3, 'US')
      expect(rate).toBeDefined()
      expect(rate?.zone).toBe('US')
      expect(rate?.weight_from).toBeLessThanOrEqual(3)
      expect(rate?.weight_to).toBeGreaterThanOrEqual(3)
    })

    it('should format shipping rate options', async () => {
      await store(new TestRequest({
        method: 'Standard',
        zone: 'US',
        weight_from: 0,
        weight_to: 5,
        rate: 1000,
      }) as any)

      const options = await formatShippingRateOptions()
      expect(options.length).toBe(1)
      expect(options[0].method).toBe('Standard')
      expect(options[0].zone).toBe('US')
      expect(options[0].rate).toBe(1000)
    })
  })

  describe('update', () => {
    it('should update an existing shipping rate', async () => {
      // First create a rate to update
      const createRequest = new TestRequest({
        method: 'Standard',
        zone: 'US',
        weight_from: 0,
        weight_to: 5,
        rate: 1000,
      })

      const rate = await store(createRequest as any)
      const rateId = rate?.id !== undefined ? Number(rate.id) : undefined

      expect(rateId).toBeDefined()
      if (!rateId) throw new Error('Failed to create test shipping rate')

      // Update the rate
      const updateData = {
        method: 'Premium',
        zone: 'US',
        weight_from: 0,
        weight_to: 10,
        rate: 2000,
      }

      const updateRequest = new TestRequest(updateData)
      const updatedRate = await update(rateId, updateRequest as any)

      expect(updatedRate).toBeDefined()
      expect(updatedRate?.method).toBe('Premium')
      expect(updatedRate?.weight_to).toBe(10)
      expect(updatedRate?.rate).toBe(2000)
    })

    it('should update rates by zone', async () => {
      // Create test rates
      await store(new TestRequest({
        method: 'Standard',
        zone: 'US',
        weight_from: 0,
        weight_to: 5,
        rate: 1000,
      }) as any)

      await store(new TestRequest({
        method: 'Express',
        zone: 'US',
        weight_from: 0,
        weight_to: 5,
        rate: 2000,
      }) as any)

      const updateData = {
        weight_from: 1,
        weight_to: 10,
        rate: 1500,
      }

      const updateRequest = new TestRequest(updateData)
      const updatedCount = await updateByZone('US', updateRequest as any)

      expect(updatedCount).toBe(2)

      const updatedRates = await getRatesByZone('US')
      expect(updatedRates[0].weight_from).toBe(1)
      expect(updatedRates[0].weight_to).toBe(10)
      expect(updatedRates[0].rate).toBe(1500)
    })

    it('should update rates by method', async () => {
      // Create test rates
      await store(new TestRequest({
        method: 'Standard',
        zone: 'US',
        weight_from: 0,
        weight_to: 5,
        rate: 1000,
      }) as any)

      await store(new TestRequest({
        method: 'Standard',
        zone: 'CA',
        weight_from: 0,
        weight_to: 5,
        rate: 1500,
      }) as any)

      const updateData = {
        rate: 2000,
      }

      const updateRequest = new TestRequest(updateData)
      const updatedCount = await updateByMethod('Standard', updateRequest as any)

      expect(updatedCount).toBe(2)

      const updatedRates = await getShippingRatesByMethod('Standard')
      expect(updatedRates[0].rate).toBe(2000)
      expect(updatedRates[1].rate).toBe(2000)
    })
  })

  describe('destroy', () => {
    it('should delete a shipping rate from the database', async () => {
      // Create a rate to delete
      const request = new TestRequest({
        method: 'Standard',
        zone: 'US',
        weight_from: 0,
        weight_to: 5,
        rate: 1000,
      })

      const rate = await store(request as any)
      const rateId = rate?.id !== undefined ? Number(rate.id) : undefined

      expect(rateId).toBeDefined()
      if (!rateId) throw new Error('Failed to create test shipping rate')

      // Verify the rate exists
      let fetchedRate = await fetchById(rateId)
      expect(fetchedRate).toBeDefined()

      // Delete the rate
      const result = await destroy(rateId)
      expect(result).toBe(true)

      // Verify the rate no longer exists
      fetchedRate = await fetchById(rateId)
      expect(fetchedRate).toBeUndefined()
    })

    it('should delete multiple shipping rates from the database', async () => {
      const rateIds = []

      // Create 3 test rates
      for (let i = 0; i < 3; i++) {
        const request = new TestRequest({
          method: `Method ${i}`,
          zone: 'US',
          weight_from: 0,
          weight_to: 5,
          rate: 1000 + i * 500,
        })

        const rate = await store(request as any)
        const rateId = rate?.id !== undefined ? Number(rate.id) : undefined
        expect(rateId).toBeDefined()
        if (rateId) rateIds.push(rateId)
      }

      expect(rateIds.length).toBe(3)

      // Delete the rates
      const deletedCount = await bulkDestroy(rateIds)
      expect(deletedCount).toBe(3)

      // Verify the rates no longer exist
      for (const id of rateIds) {
        const fetchedRate = await fetchById(id)
        expect(fetchedRate).toBeUndefined()
      }
    })

    it('should delete rates by zone', async () => {
      // Create test rates
      await store(new TestRequest({
        method: 'Standard',
        zone: 'US',
        weight_from: 0,
        weight_to: 5,
        rate: 1000,
      }) as any)

      await store(new TestRequest({
        method: 'Express',
        zone: 'US',
        weight_from: 0,
        weight_to: 5,
        rate: 2000,
      }) as any)

      const deletedCount = await destroyByZone('US')
      expect(deletedCount).toBe(2)

      const remainingRates = await getRatesByZone('US')
      expect(remainingRates.length).toBe(0)
    })

    it('should delete rates by method', async () => {
      // Create test rates
      await store(new TestRequest({
        method: 'Standard',
        zone: 'US',
        weight_from: 0,
        weight_to: 5,
        rate: 1000,
      }) as any)

      await store(new TestRequest({
        method: 'Standard',
        zone: 'CA',
        weight_from: 0,
        weight_to: 5,
        rate: 1500,
      }) as any)

      const deletedCount = await destroyByMethod('Standard')
      expect(deletedCount).toBe(2)

      const remainingRates = await getShippingRatesByMethod('Standard')
      expect(remainingRates.length).toBe(0)
    })

    it('should return 0 when trying to delete an empty array of rates', async () => {
      const deletedCount = await bulkDestroy([])
      expect(deletedCount).toBe(0)
    })
  })
})
