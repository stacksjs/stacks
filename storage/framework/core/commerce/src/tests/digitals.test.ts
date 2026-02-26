import { beforeEach, describe, expect, it } from 'bun:test'
import { refreshDatabase } from '@stacksjs/testing'
import { bulkDestroy, bulkSoftDelete } from '../shippings/digital-deliveries/destroy'
import { bulkStore } from '../shippings/digital-deliveries/store'

beforeEach(async () => {
  await refreshDatabase()
})

describe('Digital Delivery Module', () => {
  describe('store', () => {
    it('should return 0 when trying to bulk store an empty array', async () => {
      const count = await bulkStore([])
      expect(count).toBe(0)
    })
  })

  describe('destroy', () => {
    it('should return 0 when trying to delete an empty array of deliveries', async () => {
      // Try to delete with an empty array
      const deletedCount = await bulkDestroy([])
      expect(deletedCount).toBe(0)
    })

    it('should return 0 when trying to soft delete an empty array of deliveries', async () => {
      // Try to soft delete with an empty array
      const deletedCount = await bulkSoftDelete([])
      expect(deletedCount).toBe(0)
    })
  })
})
