import { beforeEach, describe, expect, it } from 'bun:test'
import { refreshDatabase } from './setup'
import { bulkDestroy, destroy } from '../gift-cards/destroy'
import { update } from '../gift-cards/update'

beforeEach(async () => {
  await refreshDatabase()
})

describe('Gift Card Module', () => {
  describe('remove', () => {
    it('should return false when trying to delete a non-existent gift card', async () => {
      expect(await destroy(99999999)).toBe(false)
    })
  })

  describe('update', () => {
    it('should return undefined when the gift card does not exist', async () => {
      expect(await update(99999999, {})).toBeUndefined()
    })
  })

  describe('bulkRemove', () => {
    it('should return 0 when trying to delete an empty array of gift cards', async () => {
      // Try to delete with an empty array
      const deletedCount = await bulkDestroy([])
      expect(deletedCount).toBe(0)
    })
  })
})
