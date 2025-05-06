import { beforeEach, describe, expect, it } from 'bun:test'
import { refreshDatabase } from '@stacksjs/testing'
import { destroy } from '../categorizables/destroy'
import { fetchById } from '../categorizables/fetch'
import { store } from '../categorizables/store'
import { update } from '../categorizables/update'

beforeEach(async () => {
  await refreshDatabase()
})

describe('Category Module', () => {
  describe('store', () => {
    it('should create a new category    in the database', async () => {
      const categoryData = {
        name: 'Technology',
        description: 'Technology related content',
        categorizable_type: 'posts',
        is_active: true,
      }

      const category = await store(categoryData)

      expect(category).toBeDefined()
      expect(category?.name).toBe('Technology')
      expect(category?.description).toBe('Technology related content')
      expect(category?.categorizable_type).toBe('posts')

      const categoryId = category?.id !== undefined ? Number(category.id) : undefined

      if (categoryId) {
        const fetchedCategory = await fetchById(categoryId)
        expect(fetchedCategory).toBeDefined()
        expect(fetchedCategory?.id).toBe(categoryId)
      }
    })

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

  describe('fetchById', () => {
    it('should fetch a category by ID', async () => {
      const categoryData = {
        name: 'Test Category',
        description: 'Test category description',
        categorizable_type: 'posts',
        is_active: true,
      }

      const category = await store(categoryData)
      const categoryId = category?.id !== undefined ? Number(category.id) : undefined

      expect(categoryId).toBeDefined()
      if (!categoryId) {
        throw new Error('Failed to create test category')
      }

      const fetchedCategory = await fetchById(categoryId)

      expect(fetchedCategory).toBeDefined()
      expect(fetchedCategory?.id).toBe(categoryId)
      expect(fetchedCategory?.name).toBe('Test Category')
      expect(fetchedCategory?.description).toBe('Test category description')
    })
  })

  describe('update', () => {
    it('should update an existing category', async () => {
      const categoryData = {
        name: 'Original Category',
        description: 'Original description',
        categorizable_type: 'posts',
        is_active: true,
      }

      const category = await store(categoryData)
      const categoryId = category?.id !== undefined ? Number(category.id) : undefined

      expect(categoryId).toBeDefined()
      if (!categoryId) {
        throw new Error('Failed to create test category')
      }

      const updatedCategory = await update({
        id: categoryId,
        name: 'Updated Category',
        description: 'Updated description',
      })

      expect(updatedCategory).toBeDefined()
      expect(updatedCategory?.id).toBe(categoryId)
      expect(updatedCategory?.name).toBe('Updated Category')
      expect(updatedCategory?.description).toBe('Updated description')
    })

    it('should throw an error when trying to update a category with invalid data', async () => {
      const categoryData = {
        name: 'Test Category',
        description: 'Test description',
        categorizable_type: 'posts',
        is_active: true,
      }

      const category = await store(categoryData)
      const categoryId = category?.id !== undefined ? Number(category.id) : undefined

      if (!categoryId) {
        throw new Error('Failed to create test category')
      }

      try {
        await update({
          id: categoryId,
          name: '', // Empty name should fail
          description: '',
        })
        expect(true).toBe(false) // This line should not be reached
      }
      catch (error) {
        expect(error).toBeDefined()
        expect(error instanceof Error).toBe(true)
      }
    })
  })

  describe('destroy', () => {
    it('should delete a category from the database', async () => {
      const categoryData = {
        name: 'Category to Delete',
        description: 'This category will be deleted',
        categorizable_type: 'posts',
        is_active: true,
      }

      const category = await store(categoryData)
      const categoryId = category?.id !== undefined ? Number(category.id) : undefined

      expect(categoryId).toBeDefined()
      if (!categoryId) {
        throw new Error('Failed to create test category')
      }

      let fetchedCategory = await fetchById(categoryId)
      expect(fetchedCategory).toBeDefined()

      const result = await destroy(categoryId)
      expect(result).toBe(true)

      fetchedCategory = await fetchById(categoryId)
      expect(fetchedCategory).toBeUndefined()
    })

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
