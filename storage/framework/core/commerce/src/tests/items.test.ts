import { beforeEach, describe, expect, it } from 'bun:test'
import { update } from '../products/items/update'
import { refreshDatabase } from './setup'

beforeEach(async () => {
  await refreshDatabase()
})

describe('Product Item Module', () => {
  describe('update', () => {
    it('should return undefined when the product does not exist', async () => {
      expect(await update(99999999, {})).toBeUndefined()
    })
  })
})
