import { beforeEach, describe, expect, it } from 'bun:test'
import { refreshDatabase } from '@stacksjs/testing'
import { bulkDestroy, bulkSoftDelete } from '../orders/destroy'
import { fetchById } from '../orders/fetch'

beforeEach(async () => {
  await refreshDatabase()
})

describe('Order Module', () => {
  it('should return undefined when fetching non-existent order', async () => {
    const fetchedOrder = await fetchById(99999999)
    expect(fetchedOrder).toBeUndefined()
  })

  it('should return 0 when bulk-deleting empty array', async () => {
    const deletedCount = await bulkDestroy([])
    expect(deletedCount).toBe(0)
  })

  it('should return 0 when bulk-soft-deleting empty array', async () => {
    const updatedCount = await bulkSoftDelete([])
    expect(updatedCount).toBe(0)
  })
})
