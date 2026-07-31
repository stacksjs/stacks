import { beforeEach, describe, expect, it } from 'bun:test'
import { refreshDatabase } from './setup'
import { bulkDestroy } from '../tax/destroy'
import { fetchAll } from '../tax/fetch'
import { bulkStore } from '../tax/store'
import { update, updateDefaultStatus } from '../tax/update'

beforeEach(async () => {
  await refreshDatabase()
})

describe('Tax Rate Module', () => {
  describe('update', () => {
    it('should return undefined when the tax rate does not exist', async () => {
      expect(await update(99999999, {})).toBeUndefined()
    })
  })

  describe('store', () => {
    it('should return 0 when trying to bulk store an empty array', async () => {
      const count = await bulkStore([])
      expect(count).toBe(0)
    })
  })

  describe('destroy', () => {
    it('should return 0 when trying to delete an empty array of tax rates', async () => {
      // Try to delete with an empty array
      const deletedCount = await bulkDestroy([])
      expect(deletedCount).toBe(0)
    })
  })

  describe('updateDefaultStatus', () => {
    it('atomically selects one default tax rate', async () => {
      await bulkStore([
        {
          name: 'Standard VAT',
          rate: 20,
          type: 'VAT',
          country: 'France',
          region: 'Europe',
          status: 'active',
          is_default: true,
        },
        {
          name: 'Reduced VAT',
          rate: 10,
          type: 'VAT',
          country: 'France',
          region: 'Europe',
          status: 'active',
          is_default: false,
        },
      ])
      const rates = await fetchAll()
      const reduced = rates.find(rate => rate.name === 'Reduced VAT')

      expect(reduced).toBeDefined()
      expect(await updateDefaultStatus(Number(reduced!.id), true)).toBe(true)

      const updated = await fetchAll()
      expect(Boolean(updated.find(rate => rate.name === 'Reduced VAT')?.is_default)).toBe(true)
      expect(Boolean(updated.find(rate => rate.name === 'Standard VAT')?.is_default)).toBe(false)
    })

    it('returns false when the tax rate does not exist', async () => {
      expect(await updateDefaultStatus(999, true)).toBe(false)
    })
  })
})
