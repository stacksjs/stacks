import { beforeEach, describe, expect, it } from 'bun:test'
import { remove } from '../products/categories/destroy'
import { update } from '../products/categories/update'
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

  describe('update', () => {
    it('should return undefined when the category does not exist', async () => {
      expect(await update(99999999, {})).toBeUndefined()
    })
  })
})
