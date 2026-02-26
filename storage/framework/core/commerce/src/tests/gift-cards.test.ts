import { beforeEach, describe, expect, it } from 'bun:test'
import { refreshDatabase } from '@stacksjs/testing'
import { bulkDestroy, destroy } from '../gift-cards/destroy'

beforeEach(async () => {
  await refreshDatabase()
})

describe('Gift Card Module', () => {
  describe('remove', () => {
    it('should throw an error when trying to delete a non-existent gift card', async () => {
      // Use a very large ID that is unlikely to exist
      const nonExistentId = 99999999

      // Attempt to delete and expect an error
      try {
        await destroy(nonExistentId)
        // If we get here, the test should fail as we expect an error
        expect(true).toBe(false) // This line should not be reached
      }
      catch (error) {
        expect(error).toBeDefined()
        expect(error instanceof Error).toBe(true)
        expect((error as Error).message).toContain(`Gift card with ID ${nonExistentId} not found`)
      }
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
