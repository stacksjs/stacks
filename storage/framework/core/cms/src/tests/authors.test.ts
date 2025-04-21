import { beforeEach, describe, expect, it } from 'bun:test'
import { refreshDatabase } from '@stacksjs/testing'
import { destroy } from '../authors/destroy'
import { fetchById } from '../authors/fetch'
import { store } from '../authors/store'
import { update } from '../authors/update'

beforeEach(async () => {
  await refreshDatabase()
})

describe('Author Module', () => {
  describe('store', () => {
    it('should create a new author in the database', async () => {
      const authorData = {
        name: 'John Doe',
        email: 'john.doe@example.com',
        user_id: 1,
      }

      const author = await store(authorData)

      expect(author).toBeDefined()
      expect(author?.name).toBe('John Doe')
      expect(author?.email).toBe('john.doe@example.com')
      expect(author?.user_id).toBe(1)

      const authorId = author?.id !== undefined ? Number(author.id) : undefined

      if (authorId) {
        const fetchedAuthor = await fetchById(authorId)
        expect(fetchedAuthor).toBeDefined()
        expect(fetchedAuthor?.id).toBe(authorId)
      }
    })

    it('should throw an error when trying to create an author with invalid data', async () => {
      const authorData = {
        name: 'Jo', // Too short, minimum 5 characters
        email: 'invalid-email', // Invalid email format
        user_id: -1, // Invalid user ID
      }

      try {
        await store(authorData)
        expect(true).toBe(false) // This line should not be reached
      }
      catch (error) {
        expect(error).toBeDefined()
        expect(error instanceof Error).toBe(true)
      }
    })

    it('should not allow duplicate email addresses', async () => {
      const firstAuthor = await store({
        name: 'John Smith',
        email: 'john.smith@example.com',
        user_id: 1,
      })

      expect(firstAuthor).toBeDefined()

      try {
        await store({
          name: 'Different Name',
          email: 'john.smith@example.com', // Same email as first author
          user_id: 2,
        })
        expect(true).toBe(false) // This line should not be reached
      }
      catch (error) {
        expect(error).toBeDefined()
        expect(error instanceof Error).toBe(true)
      }
    })
  })

  describe('fetchById', () => {
    it('should fetch an author by ID', async () => {
      const authorData = {
        name: 'Jane Smith',
        email: 'jane.smith@example.com',
        user_id: 1,
      }

      const author = await store(authorData)
      const authorId = author?.id !== undefined ? Number(author.id) : undefined

      expect(authorId).toBeDefined()
      if (!authorId) {
        throw new Error('Failed to create test author')
      }

      const fetchedAuthor = await fetchById(authorId)

      expect(fetchedAuthor).toBeDefined()
      expect(fetchedAuthor?.id).toBe(authorId)
      expect(fetchedAuthor?.name).toBe('Jane Smith')
      expect(fetchedAuthor?.email).toBe('jane.smith@example.com')
      expect(fetchedAuthor?.user_id).toBe(1)
    })
  })

  describe('update', () => {
    it('should update an existing author', async () => {
      const authorData = {
        name: 'Original Name',
        email: 'original@example.com',
        user_id: 1,
      }

      const author = await store(authorData)
      const authorId = author?.id !== undefined ? Number(author.id) : undefined

      expect(authorId).toBeDefined()
      if (!authorId) {
        throw new Error('Failed to create test author')
      }

      const updatedAuthor = await update(authorId, {
        name: 'Updated Name',
        email: 'updated@example.com',
      })

      expect(updatedAuthor).toBeDefined()
      expect(updatedAuthor?.id).toBe(authorId)
      expect(updatedAuthor?.name).toBe('Updated Name')
      expect(updatedAuthor?.email).toBe('updated@example.com')
    })

    it('should throw an error when trying to update an author with invalid data', async () => {
      const authorData = {
        name: 'Test Author',
        email: 'test@example.com',
        user_id: 1,
      }

      const author = await store(authorData)
      const authorId = author?.id !== undefined ? Number(author.id) : undefined

      if (!authorId) {
        throw new Error('Failed to create test author')
      }

      try {
        await update(authorId, {
          name: 'Jo', // Too short
          email: 'invalid-email', // Invalid email
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
    it('should delete an author from the database', async () => {
      const authorData = {
        name: 'Author to Delete',
        email: 'delete@example.com',
        user_id: 1,
      }

      const author = await store(authorData)
      const authorId = author?.id !== undefined ? Number(author.id) : undefined

      expect(authorId).toBeDefined()
      if (!authorId) {
        throw new Error('Failed to create test author')
      }

      let fetchedAuthor = await fetchById(authorId)
      expect(fetchedAuthor).toBeDefined()

      await destroy(authorId)

      fetchedAuthor = await fetchById(authorId)
      expect(fetchedAuthor).toBeUndefined()
    })

    it('should throw an error when trying to delete a non-existent author', async () => {
      const nonExistentId = 99999999

      try {
        await destroy(nonExistentId)
        expect(true).toBe(false) // This line should not be reached
      }
      catch (error) {
        expect(error).toBeDefined()
        expect(error instanceof Error).toBe(true)
        expect((error as Error).message).toContain(`Author with ID ${nonExistentId} not found`)
      }
    })
  })
})
