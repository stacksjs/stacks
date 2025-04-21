import { beforeEach, describe, expect, it } from 'bun:test'
import { refreshDatabase } from '@stacksjs/testing'
import { destroy } from '../posts/destroy'
import { fetchById } from '../posts/fetch'
import { store } from '../posts/store'
import { update } from '../posts/update'

beforeEach(async () => {
  await refreshDatabase()
})

describe('Post Module', () => {
  describe('store', () => {
    it('should create a new post in the database', async () => {
      const postData = {
        user_id: 1,
        title: 'Test Post Title',
        author: 'Test Author',
        category: 'Technology',
        poster: 'https://example.com/default-poster.jpg',
        body: 'This is a test post body with more than 10 characters.',
        views: 0,
        publishedAt: Date.now(),
        status: 'draft',
      }

      const post = await store(postData)

      expect(post).toBeDefined()
      expect(post?.title).toBe('Test Post Title')
      expect(post?.author).toBe('Test Author')
      expect(post?.category).toBe('Technology')
      expect(post?.body).toBe('This is a test post body with more than 10 characters.')
      expect(post?.views).toBe(0)
      expect(post?.status).toBe('draft')

      // Save the ID and convert from Generated<number> to number
      const postId = post?.id !== undefined ? Number(post.id) : undefined

      // Verify we can fetch the post we just created
      if (postId) {
        const fetchedPost = await fetchById(postId)
        expect(fetchedPost).toBeDefined()
        expect(fetchedPost?.id).toBe(postId)
      }
    })

    it('should create a post with custom poster field', async () => {
      const postData = {
        user_id: 1,
        title: 'Post with Poster',
        author: 'Test Author',
        category: 'Technology',
        body: 'This is a test post body with more than 10 characters.',
        poster: 'https://example.com/poster.jpg',
        views: 0,
        publishedAt: Date.now(),
        status: 'draft',
      }

      const post = await store(postData)

      expect(post).toBeDefined()
      expect(post?.poster).toBe('https://example.com/poster.jpg')
    })

    it('should throw an error when trying to create a post with invalid data', async () => {
      const postData = {
        user_id: 1,
        title: '', // Empty title should fail
        author: 'Test Author',
        category: 'Tech',
        poster: 'https://example.com/poster.jpg',
        body: 'Too short',
        views: -1,
        publishedAt: -1,
        status: 'invalid',
      }

      try {
        await store(postData)
        expect(true).toBe(false) // This line should not be reached
      }
      catch (error) {
        expect(error).toBeDefined()
        expect(error instanceof Error).toBe(true)
      }
    })
  })

  describe('fetchById', () => {
    it('should fetch a post by ID', async () => {
      // First create a post to fetch
      const postData = {
        user_id: 1,
        title: 'Fetch Test Post',
        author: 'Test Author',
        category: 'Technology',
        poster: 'https://example.com/poster.jpg',
        body: 'This is a test post body with more than 10 characters.',
        views: 0,
        publishedAt: Date.now(),
        status: 'draft',
      }

      const post = await store(postData)
      const postId = post?.id !== undefined ? Number(post.id) : undefined

      // Make sure we have a valid post ID before proceeding
      expect(postId).toBeDefined()
      if (!postId) {
        throw new Error('Failed to create test post')
      }

      // Now fetch the post
      const fetchedPost = await fetchById(postId)

      expect(fetchedPost).toBeDefined()
      expect(fetchedPost?.id).toBe(postId)
      expect(fetchedPost?.title).toBe('Fetch Test Post')
      expect(fetchedPost?.author).toBe('Test Author')
    })
  })

  describe('update', () => {
    it('should update an existing post', async () => {
      // First create a post to update
      const postData = {
        user_id: 1,
        title: 'Update Test Post',
        author: 'Test Author',
        category: 'Technology',
        poster: 'https://example.com/poster.jpg',
        body: 'This is a test post body with more than 10 characters.',
        views: 0,
        publishedAt: Date.now(),
        status: 'draft',
      }

      // Create the post
      const post = await store(postData)

      const postId = post?.id !== undefined ? Number(post.id) : undefined

      // Make sure we have a valid post ID before proceeding
      expect(postId).toBeDefined()
      if (!postId) {
        throw new Error('Failed to create test post')
      }

      // Update the post with new data
      const updateData = {
        title: 'Updated Post Title',
        status: 'published',
        views: 100,
      }

      const updatedPost = await update(postId, updateData)

      // Verify the update was successful
      expect(updatedPost).toBeDefined()
      expect(updatedPost?.id).toBe(postId)
      expect(updatedPost?.title).toBe('Updated Post Title')
      expect(updatedPost?.status).toBe('published')
      expect(updatedPost?.views).toBe(100)

      // The other fields should remain unchanged
      expect(updatedPost?.author).toBe('Test Author')
      expect(updatedPost?.category).toBe('Technology')
    })

    it('should throw an error when trying to update a post with invalid data', async () => {
      // First create a post to update
      const postData = {
        user_id: 1,
        title: 'Invalid Update Test Post',
        author: 'Test Author',
        category: 'Technology',
        poster: 'https://example.com/poster.jpg',
        body: 'This is a test post body with more than 10 characters.',
        views: 0,
        publishedAt: Date.now(),
        status: 'draft',
      }

      const post = await store(postData)
      const postId = post?.id !== undefined ? Number(post.id) : undefined

      if (!postId) {
        throw new Error('Failed to create test post')
      }

      // Try to update with invalid data
      const updateData = {
        title: '', // Empty title should fail
        status: 'invalid',
        views: -1,
      }

      try {
        await update(postId, updateData)
        expect(true).toBe(false) // This line should not be reached
      }
      catch (error) {
        expect(error).toBeDefined()
        expect(error instanceof Error).toBe(true)
      }
    })
  })

  describe('destroy', () => {
    it('should delete a post from the database', async () => {
      // First create a post to delete
      const postData = {
        user_id: 1,
        title: 'Delete Test Post',
        author: 'Test Author',
        category: 'Technology',
        poster: 'https://example.com/poster.jpg',
        body: 'This is a test post body with more than 10 characters.',
        views: 0,
        publishedAt: Date.now(),
        status: 'draft',
      }

      // Create the post
      const post = await store(postData)
      const postId = post?.id !== undefined ? Number(post.id) : undefined

      // Make sure we have a valid post ID before proceeding
      expect(postId).toBeDefined()
      if (!postId) {
        throw new Error('Failed to create test post')
      }

      // Verify the post exists
      let fetchedPost = await fetchById(postId)
      expect(fetchedPost).toBeDefined()

      // Delete the post
      const result = await destroy(postId)
      expect(result).toBe(true)

      // Verify the post no longer exists
      fetchedPost = await fetchById(postId)
      expect(fetchedPost).toBeUndefined()
    })

    it('should throw an error when trying to delete a non-existent post', async () => {
      // Use a very large ID that is unlikely to exist
      const nonExistentId = 99999999

      // Attempt to delete and expect an error
      try {
        await destroy(nonExistentId)
        expect(true).toBe(false) // This line should not be reached
      }
      catch (error) {
        expect(error).toBeDefined()
        expect(error instanceof Error).toBe(true)
        expect((error as Error).message).toContain(`Post with ID ${nonExistentId} not found`)
      }
    })
  })
})
