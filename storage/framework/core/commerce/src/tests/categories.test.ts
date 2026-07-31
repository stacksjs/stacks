import { beforeEach, describe, expect, it } from 'bun:test'
import { remove } from '../products/categories/destroy'
import { refreshDatabase } from './setup'

beforeEach(async () => {
  await refreshDatabase()
})

describe('Category Module', () => {
  describe('remove', () => {
    it('should return false when the category does not exist', async () => {
      expect(await remove(99999999)).toBe(false)
    })
  })
})
