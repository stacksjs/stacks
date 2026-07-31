import { beforeEach, describe, expect, it } from 'bun:test'
import { refreshDatabase } from './setup'
import { bulkDestroy, destroy } from '../shippings/drivers/destroy'
import { bulkStore } from '../shippings/drivers/store'

beforeEach(async () => {
  await refreshDatabase()
})

describe('Driver Module', () => {
  describe('store', () => {
    it('should return 0 when trying to bulk store an empty array', async () => {
      const count = await bulkStore([])
      expect(count).toBe(0)
    })
  })

  describe('destroy', () => {
    it('should return false when the driver does not exist', async () => {
      expect(await destroy(999999)).toBe(false)
    })

    it('should return 0 when trying to delete an empty array of drivers', async () => {
      // Try to delete with an empty array
      const deletedCount = await bulkDestroy([])
      expect(deletedCount).toBe(0)
    })
  })
})
