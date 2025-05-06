import { beforeEach, describe, expect, it } from 'bun:test'
import { refreshDatabase } from '@stacksjs/testing'
import { destroy } from '../taggables/destroy'
import { fetchTagById } from '../taggables/fetch'
import { store } from '../taggables/store'
import { update } from '../taggables/update'

beforeEach(async () => {
  await refreshDatabase()
})

describe('Tag Module', () => {
  describe('store', () => {
    it('should create a new tag in the database', async () => {
      const tagData = {
        name: 'JavaScript',
        description: 'JavaScript related content',
        taggable_id: 1,
        taggable_type: 'posts',
        is_active: true,
      }

      const tag = await store(tagData)

      expect(tag).toBeDefined()
      expect(tag?.name).toBe('JavaScript')
      expect(tag?.description).toBe('JavaScript related content')
      expect(tag?.taggable_id).toBe(1)
      expect(tag?.taggable_type).toBe('posts')
      expect(tag?.slug).toBe('javascript') // Should be auto-generated from name

      const tagId = tag?.id !== undefined ? Number(tag.id) : undefined

      if (tagId) {
        const fetchedTag = await fetchTagById(tagId)
        expect(fetchedTag).toBeDefined()
        expect(fetchedTag?.id).toBe(tagId)
      }
    })

    it('should create multiple tags for the same post', async () => {
      const firstTag = await store({
        name: 'JavaScript',
        description: 'JavaScript related content',
        taggable_id: 1,
        taggable_type: 'posts',
        is_active: true,
      })

      const secondTag = await store({
        name: 'TypeScript',
        description: 'TypeScript related content',
        taggable_id: 1,
        taggable_type: 'posts',
        is_active: true,
      })

      expect(firstTag).toBeDefined()
      expect(secondTag).toBeDefined()
      expect(firstTag?.taggable_id).toBe(secondTag?.taggable_id)
      expect(firstTag?.taggable_type).toBe(secondTag?.taggable_type)
      expect(firstTag?.slug).toBe('javascript')
      expect(secondTag?.slug).toBe('typescript')
    })

    it('should throw an error when trying to create a tag with invalid data', async () => {
      const tagData = {
        name: '', // Empty name should fail
        description: '',
        taggable_id: -1,
        taggable_type: '',
        is_active: false,
      }

      try {
        await store(tagData)
        expect(true).toBe(false) // This line should not be reached
      }
      catch (error) {
        expect(error).toBeDefined()
        expect(error instanceof Error).toBe(true)
      }
    })

    it('should enforce unique slugs', async () => {
      // Create first tag
      await store({
        name: 'JavaScript',
        description: 'JavaScript content',
        taggable_id: 1,
        taggable_type: 'posts',
        is_active: true,
      })

      // Try to create another tag that would generate the same slug
      try {
        await store({
          name: 'JavaScript',
          description: 'Another JavaScript content',
          taggable_id: 2,
          taggable_type: 'posts',
          is_active: true,
        })
        expect(true).toBe(false) // This line should not be reached
      }
      catch (error) {
        expect(error).toBeDefined()
        expect(error instanceof Error).toBe(true)
        expect((error as Error).message).toContain('unique')
      }
    })
  })

  describe('fetchById', () => {
    it('should fetch a tag by ID', async () => {
      const tagData = {
        name: 'Test Tag',
        description: 'Test tag description',
        taggable_id: 1,
        taggable_type: 'posts',
        is_active: true,
      }

      const tag = await store(tagData)
      const tagId = tag?.id !== undefined ? Number(tag.id) : undefined

      expect(tagId).toBeDefined()
      if (!tagId) {
        throw new Error('Failed to create test tag')
      }

      const fetchedTag = await fetchTagById(tagId)

      expect(fetchedTag).toBeDefined()
      expect(fetchedTag?.id).toBe(tagId)
      expect(fetchedTag?.name).toBe('Test Tag')
      expect(fetchedTag?.description).toBe('Test tag description')
      expect(fetchedTag?.slug).toBe('test-tag')
    })
  })

  describe('update', () => {
    it('should update an existing tag', async () => {
      const tagData = {
        name: 'Original Tag',
        description: 'Original description',
        taggable_id: 1,
        taggable_type: 'posts',
        is_active: true,
      }

      const tag = await store(tagData)
      const tagId = tag?.id !== undefined ? Number(tag.id) : undefined

      expect(tagId).toBeDefined()
      if (!tagId) {
        throw new Error('Failed to create test tag')
      }

      const updatedTag = await update({
        id: tagId,
        name: 'Updated Tag',
        description: 'Updated description',
      })

      expect(updatedTag).toBeDefined()
      expect(updatedTag?.id).toBe(tagId)
      expect(updatedTag?.name).toBe('Updated Tag')
      expect(updatedTag?.description).toBe('Updated description')
      expect(updatedTag?.slug).toBe('updated-tag')
    })

    it('should throw an error when trying to update a tag with invalid data', async () => {
      const tagData = {
        name: 'Test Tag',
        description: 'Test description',
        taggable_id: 1,
        taggable_type: 'posts',
        is_active: true,
      }

      const tag = await store(tagData)
      const tagId = tag?.id !== undefined ? Number(tag.id) : undefined

      if (!tagId) {
        throw new Error('Failed to create test tag')
      }

      try {
        await update({
          id: tagId,
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

    it('should enforce unique slugs on update', async () => {
      // Create two tags
    //   const firstTag = await store({
    //     name: 'First Tag',
    //     description: 'First tag content',
    //     taggable_id: 1,
    //     taggable_type: 'posts',
    //     is_active: true,
    //   })

      const secondTag = await store({
        name: 'Second Tag',
        description: 'Second tag content',
        taggable_id: 2,
        taggable_type: 'posts',
        is_active: true,
      })

      // Try to update second tag to have same name as first (which would generate same slug)
      try {
        await update({
          id: Number(secondTag?.id),
          name: 'First Tag',
        })
        expect(true).toBe(false) // This line should not be reached
      }
      catch (error) {
        expect(error).toBeDefined()
        expect(error instanceof Error).toBe(true)
        expect((error as Error).message).toContain('unique')
      }
    })
  })

  describe('destroy', () => {
    it('should delete a tag from the database', async () => {
      const tagData = {
        name: 'Tag to Delete',
        description: 'This tag will be deleted',
        taggable_id: 1,
        taggable_type: 'posts',
        is_active: true,
      }

      const tag = await store(tagData)
      const tagId = tag?.id !== undefined ? Number(tag.id) : undefined

      expect(tagId).toBeDefined()
      if (!tagId) {
        throw new Error('Failed to create test tag')
      }

      let fetchedTag = await fetchTagById(tagId)
      expect(fetchedTag).toBeDefined()

      await destroy(tagId)

      fetchedTag = await fetchTagById(tagId)
      expect(fetchedTag).toBeUndefined()
    })

    it('should throw an error when trying to delete a non-existent tag', async () => {
      const nonExistentId = 99999999

      try {
        await destroy(nonExistentId)
        expect(true).toBe(false) // This line should not be reached
      }
      catch (error) {
        expect(error).toBeDefined()
        expect(error instanceof Error).toBe(true)
        expect((error as Error).message).toContain(`Tag with ID ${nonExistentId} not found`)
      }
    })
  })
})
