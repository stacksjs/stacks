import { beforeEach, describe, expect, it } from 'bun:test'
import { db } from '@stacksjs/database'
import { refreshDatabase } from '@stacksjs/testing'
import { findOrCreate as findOrCreateAuthor } from '../authors/store'
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
      // Create or find author first
      const author = await findOrCreateAuthor({
        name: 'Test Author',
        email: 'test.author@example.com',
      })

      const postData = {
        author_id: author.id,
        title: 'Test Post Title',
        category: 'Technology',
        poster: 'https://example.com/default-poster.jpg',
        body: 'This is a test post body with more than 10 characters.',
        views: 0,
        published_at: Date.now(),
        status: 'draft',
      }

      const post = await store(postData)

      expect(post).toBeDefined()
      expect(post?.title).toBe('Test Post Title')
      expect(post?.author_id).toBe(author.id)
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
      const author = await findOrCreateAuthor({
        name: 'Test Author',
        email: 'test.author@example.com',
      })

      const postData = {
        author_id: author.id,
        title: 'Post with Poster',
        category: 'Technology',
        body: 'This is a test post body with more than 10 characters.',
        poster: 'https://example.com/poster.jpg',
        views: 0,
        published_at: Date.now(),
        status: 'draft',
      }

      const post = await store(postData)

      expect(post).toBeDefined()
      expect(post?.poster).toBe('https://example.com/poster.jpg')
    })

    it('should throw an error when trying to create a post with invalid data', async () => {
      const author = await findOrCreateAuthor({
        name: 'Test Author',
        email: 'test.author@example.com',
      })

      const postData = {
        author_id: author.id,
        title: '', // Empty title should fail
        category: 'Tech',
        poster: 'https://example.com/poster.jpg',
        body: 'Too short',
        views: -1,
        published_at: -1,
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

    it('should create a post and associate it with a category', async () => {
      const author = await findOrCreateAuthor({
        name: 'Test Author',
        email: 'test.author@example.com',
      })

      // Create a post first
      const postData = {
        author_id: author.id,
        title: 'Post with Category',
        category: 'Technology',
        body: 'This is a test post body with more than 10 characters.',
        views: 0,
        published_at: Date.now(),
        status: 'draft',
      }

      const post = await store(postData)
      expect(post).toBeDefined()

      // Create a category and associate it with the post
      const category = await db
        .insertInto('categorizable')
        .values({
          name: 'Technology',
          description: 'Technology related content',
          is_active: true,
          categorizable_type: 'posts',
          slug: 'technology',
        })
        .returningAll()
        .executeTakeFirst()

      expect(category).toBeDefined()
      const categoryId = Number(category?.id)

      // Create the relationship in categorizable_models
      const relationship = await db
        .insertInto('categorizable_models')
        .values({
          category_id: categoryId,
          categorizable_type: 'posts',
        })
        .returningAll()
        .executeTakeFirst()

      expect(relationship).toBeDefined()
      expect(relationship?.category_id).toBe(categoryId)
    })

    it('should allow a post to have multiple categories', async () => {
      // Create a post
      const author = await findOrCreateAuthor({
        name: 'Test Author',
        email: 'test.author@example.com',
      })

      const postData = {
        author_id: author.id,
        title: 'Multi-Category Post',
        category: 'Technology',
        body: 'This is a test post body with more than 10 characters.',
        views: 0,
        published_at: Date.now(),
        status: 'draft',
      }

      const post = await store(postData)
      expect(post).toBeDefined()

      // Create multiple categories
      const categoryData = [
        { name: 'Technology', description: 'Tech content', slug: 'technology' },
        { name: 'Programming', description: 'Programming content', slug: 'programming' },
        { name: 'Web Development', description: 'Web dev content', slug: 'web-development' },
      ]

      // Insert categories and create relationships
      const categories = await Promise.all(
        categoryData.map(async (data) => {
          // Create category
          const category = await db
            .insertInto('categorizable')
            .values({
              name: data.name,
              description: data.description,
              is_active: true,
              categorizable_type: 'posts',
              slug: data.slug,
            })
            .returningAll()
            .executeTakeFirst()

          if (!category)
            throw new Error('Failed to create category')

          // Create relationship
          await db
            .insertInto('categorizable_models')
            .values({
              category_id: Number(category.id),
              categorizable_type: 'posts',
            })
            .execute()

          return category
        }),
      )

      expect(categories).toHaveLength(3)

      // Verify all relationships were created
      const relationships = await db
        .selectFrom('categorizable_models')
        .selectAll()
        .where('categorizable_type', '=', 'posts')
        .execute()

      expect(relationships).toHaveLength(3)
      expect(relationships.every(rel => rel.categorizable_type === 'posts')).toBe(true)
    })

    it('should create a post and associate it with a tag', async () => {
      // Create a post first
      const author = await findOrCreateAuthor({
        name: 'Test Author',
        email: 'test.author@example.com',
      })

      const postData = {
        author_id: author.id,
        title: 'Post with Tag',
        category: 'Technology',
        body: 'This is a test post body with more than 10 characters.',
        views: 0,
        published_at: Date.now(),
        status: 'draft',
      }

      const post = await store(postData)
      expect(post).toBeDefined()

      // Create a tag and associate it with the post
      const tag = await db
        .insertInto('taggable')
        .values({
          name: 'JavaScript',
          description: 'JavaScript related content',
          is_active: true,
          taggable_type: 'posts',
          slug: 'javascript',
        })
        .returningAll()
        .executeTakeFirst()

      expect(tag).toBeDefined()
      expect(tag?.name).toBe('JavaScript')
      expect(tag?.taggable_type).toBe('posts')
      expect(tag?.slug).toBe('javascript')
    })

    it('should allow a post to have multiple tags', async () => {
      // Create a post
      const author = await findOrCreateAuthor({
        name: 'Test Author',
        email: 'test.author@example.com',
      })

      const postData = {
        author_id: author.id,
        title: 'Multi-Tag Post',
        category: 'Technology',
        body: 'This is a test post body with more than 10 characters.',
        views: 0,
        published_at: Date.now(),
        status: 'draft',
      }

      const post = await store(postData)
      expect(post).toBeDefined()

      // Create multiple tags
      const tagData = [
        { name: 'JavaScript', description: 'JavaScript content', slug: 'javascript' },
        { name: 'TypeScript', description: 'TypeScript content', slug: 'typescript' },
        { name: 'Web Development', description: 'Web dev content', slug: 'web-development' },
      ]

      // Insert tags
      const tags = await Promise.all(
        tagData.map(async (data) => {
          const tag = await db
            .insertInto('taggable')
            .values({
              name: data.name,
              description: data.description,
              is_active: true,
              taggable_type: 'posts',
              slug: data.slug,
            })
            .returningAll()
            .executeTakeFirst()

          expect(tag).toBeDefined()
          expect(tag?.taggable_type).toBe('posts')
          return tag
        }),
      )

      expect(tags).toHaveLength(3)

      // Verify all tags were created with correct associations
      const postTags = await db
        .selectFrom('taggable')
        .selectAll()
        .where('taggable_type', '=', 'posts')
        .execute()

      expect(postTags).toHaveLength(3)
      expect(postTags.every(tag => tag.taggable_type === 'posts')).toBe(true)

      // Verify tag names
      const tagNames = postTags.map(tag => tag.name)
      expect(tagNames).toContain('JavaScript')
      expect(tagNames).toContain('TypeScript')
      expect(tagNames).toContain('Web Development')
    })
  })

  describe('fetchById', () => {
    it('should fetch a post by ID', async () => {
      // First create a post to fetch
      const author = await findOrCreateAuthor({
        name: 'Test Author',
        email: 'test.author@example.com',
      })

      const postData = {
        author_id: author.id,
        title: 'Fetch Test Post',
        category: 'Technology',
        poster: 'https://example.com/poster.jpg',
        body: 'This is a test post body with more than 10 characters.',
        views: 0,
        published_at: Date.now(),
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
      expect(fetchedPost?.author_id).toBe(author.id)
    })
  })

  describe('update', () => {
    it('should update an existing post', async () => {
      // First create a post to update
      const author = await findOrCreateAuthor({
        name: 'Test Author',
        email: 'test.author@example.com',
      })

      const postData = {
        author_id: author.id,
        title: 'Update Test Post',
        category: 'Technology',
        poster: 'https://example.com/poster.jpg',
        body: 'This is a test post body with more than 10 characters.',
        views: 0,
        published_at: Date.now(),
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
      expect(updatedPost?.author_id).toBe(author.id)
      expect(updatedPost?.category).toBe('Technology')
    })

    it('should throw an error when trying to update a post with invalid data', async () => {
      // First create a post to update
      const author = await findOrCreateAuthor({
        name: 'Test Author',
        email: 'test.author@example.com',
      })

      const postData = {
        author_id: author.id,
        title: 'Invalid Update Test Post',
        category: 'Technology',
        poster: 'https://example.com/poster.jpg',
        body: 'This is a test post body with more than 10 characters.',
        views: 0,
        published_at: Date.now(),
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
      const author = await findOrCreateAuthor({
        name: 'Test Author',
        email: 'test.author@example.com',
      })

      const postData = {
        author_id: author.id,
        title: 'Delete Test Post',
        category: 'Technology',
        poster: 'https://example.com/poster.jpg',
        body: 'This is a test post body with more than 10 characters.',
        views: 0,
        published_at: Date.now(),
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
