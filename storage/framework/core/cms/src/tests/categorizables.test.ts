import { beforeEach, describe, expect, it } from 'bun:test'
import { refreshDatabase } from '@stacksjs/testing'
import { destroy } from '../categorizables/destroy'
import { store } from '../categorizables/store'

beforeEach(async () => {
  await refreshDatabase()
})

describe('Category Module', () => {
  describe('store', () => {
    it('should create multiple categories for the same post', async () => {
      const firstCategory = await store({
        name: 'Technology',
        description: 'Technology related content',
        categorizable_type: 'posts',
        is_active: true,
      })

      const secondCategory = await store({
        name: 'Programming',
        description: 'Programming related content',
        categorizable_type: 'posts',
        is_active: true,
      })

      expect(firstCategory).toBeDefined()
      expect(secondCategory).toBeDefined()
      expect(firstCategory?.categorizable_type).toBe(secondCategory?.categorizable_type)
    })

    it('should throw an error when trying to create a category with invalid data', async () => {
      const categoryData = {
        name: '', // Empty name should fail
        description: '',
        categorizable_type: '',
        is_active: false,
      }

      try {
        await store(categoryData)
        expect(true).toBe(false) // This line should not be reached
      }
      catch (error) {
        expect(error).toBeDefined()
        expect(error instanceof Error).toBe(true)
      }
    })
  })

  describe('destroy', () => {
    it('should throw an error when trying to delete a non-existent category', async () => {
      const nonExistentId = 99999999

      try {
        await destroy(nonExistentId)
        expect(true).toBe(false) // This line should not be reached
      }
      catch (error) {
        expect(error).toBeDefined()
        expect(error instanceof Error).toBe(true)
        expect((error as Error).message).toContain(`Category with ID ${nonExistentId} not found`)
      }
    })
  })
})
