import { beforeEach, describe, expect, it } from 'bun:test'
import { refreshDatabase } from './setup'
import { destroy } from '../customers/destroy'

beforeEach(async () => {
  await refreshDatabase()
})

describe('Customer Module', () => {
  describe('remove', () => {
    it('should return false when trying to delete a non-existent customer', async () => {
      expect(await destroy(99999999)).toBe(false)
    })
  })

  describe('bulkRemove', () => {
    it('should return 0 when trying to delete an empty array of customers', async () => {
      // Import the bulkRemove function
      const { bulkDestroy } = await import('../customers/destroy')

      // Try to delete with an empty array
      const deletedCount = await bulkDestroy([])
      expect(deletedCount).toBe(0)
    })
  })
})
