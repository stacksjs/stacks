import { beforeEach, describe, expect, it } from 'bun:test'
import { refreshDatabase } from '@stacksjs/testing'
import { bulkDestroy } from '../shippings/drivers/destroy'
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
    it('should return 0 when trying to delete an empty array of drivers', async () => {
      // Try to delete with an empty array
      const deletedCount = await bulkDestroy([])
      expect(deletedCount).toBe(0)
    })
  })
})
