import { beforeEach, describe, expect, it } from 'bun:test'
import { refreshDatabase } from '@stacksjs/testing'
import { findOrCreate as findOrCreateAuthor } from '../authors/store'
import { destroy } from '../pages/destroy'
import { fetchById } from '../pages/fetch'
import { store } from '../pages/store'
import { update } from '../pages/update'

beforeEach(async () => {
  await refreshDatabase()
})

describe('Page Module', () => {
  describe('store', () => {
    it('should create a new page in the database', async () => {
      // Create or find author first
      const author = await findOrCreateAuthor({
        name: 'Test Author',
        email: 'test.author@example.com',
      })

      const pageData = {
        author_id: author.id,
        title: 'Test Page Title',
        template: 'landing',
        views: 0,
        conversions: 0,
        published_at: Date.now(),
      }

      const page = await store(pageData)

      expect(page).toBeDefined()
      expect(page?.title).toBe('Test Page Title')
      expect(page?.author_id).toBe(author.id)
      expect(page?.template).toBe('landing')
      expect(page?.views).toBe(0)
      expect(page?.conversions).toBe(0)

      // Save the ID and convert from Generated<number> to number
      const pageId = page?.id !== undefined ? Number(page.id) : undefined

      // Verify we can fetch the page we just created
      if (pageId) {
        const fetchedPage = await fetchById(pageId)
        expect(fetchedPage).toBeDefined()
        expect(fetchedPage?.id).toBe(pageId)
      }
    })

    it('should create a page with custom template', async () => {
      const author = await findOrCreateAuthor({
        name: 'Test Author',
        email: 'test.author@example.com',
      })

      const pageData = {
        author_id: author.id,
        title: 'Page with Custom Template',
        template: 'blog',
        views: 0,
        conversions: 0,
        published_at: Date.now(),
      }

      const page = await store(pageData)

      expect(page).toBeDefined()
      expect(page?.template).toBe('blog')
    })

    it('should throw an error when trying to create a page with invalid data', async () => {
      const author = await findOrCreateAuthor({
        name: 'Test Author',
        email: 'test.author@example.com',
      })

      const pageData = {
        author_id: author.id,
        title: '', // Empty title should fail
        template: 'invalid', // Invalid template should fail
        views: -1, // Negative views should fail
        conversions: -1, // Negative conversions should fail
        published_at: -1, // Negative timestamp should fail
      }

      try {
        await store(pageData)
        expect(true).toBe(false) // This line should not be reached
      }
      catch (error) {
        expect(error).toBeDefined()
        expect(error instanceof Error).toBe(true)
      }
    })
  })

  describe('fetchById', () => {
    it('should fetch a page by ID', async () => {
      // First create a page to fetch
      const author = await findOrCreateAuthor({
        name: 'Test Author',
        email: 'test.author@example.com',
      })

      const pageData = {
        author_id: author.id,
        title: 'Fetch Test Page',
        template: 'default',
        views: 0,
        conversions: 0,
        published_at: Date.now(),
      }

      const page = await store(pageData)
      const pageId = page?.id !== undefined ? Number(page.id) : undefined

      // Make sure we have a valid page ID before proceeding
      expect(pageId).toBeDefined()
      if (!pageId) {
        throw new Error('Failed to create test page')
      }

      // Now fetch the page
      const fetchedPage = await fetchById(pageId)

      expect(fetchedPage).toBeDefined()
      expect(fetchedPage?.id).toBe(pageId)
      expect(fetchedPage?.title).toBe('Fetch Test Page')
      expect(fetchedPage?.author_id).toBe(author.id)
    })
  })

  describe('update', () => {
    it('should update an existing page', async () => {
      // First create a page to update
      const author = await findOrCreateAuthor({
        name: 'Test Author',
        email: 'test.author@example.com',
      })

      const pageData = {
        author_id: author.id,
        title: 'Update Test Page',
        template: 'default',
        views: 0,
        conversions: 0,
        published_at: Date.now(),
      }

      // Create the page
      const page = await store(pageData)

      const pageId = page?.id !== undefined ? Number(page.id) : undefined

      // Make sure we have a valid page ID before proceeding
      expect(pageId).toBeDefined()
      if (!pageId) {
        throw new Error('Failed to create test page')
      }

      // Update the page with new data
      const updateData = {
        title: 'Updated Page Title',
        template: 'landing',
        views: 100,
        conversions: 5,
      }

      const updatedPage = await update(pageId, updateData)

      // Verify the update was successful
      expect(updatedPage).toBeDefined()
      expect(updatedPage?.id).toBe(pageId)
      expect(updatedPage?.title).toBe('Updated Page Title')
      expect(updatedPage?.template).toBe('landing')
      expect(updatedPage?.views).toBe(100)
      expect(updatedPage?.conversions).toBe(5)

      // The other fields should remain unchanged
      expect(updatedPage?.author_id).toBe(author.id)
    })

    it('should throw an error when trying to update a page with invalid data', async () => {
      // First create a page to update
      const author = await findOrCreateAuthor({
        name: 'Test Author',
        email: 'test.author@example.com',
      })

      const pageData = {
        author_id: author.id,
        title: 'Invalid Update Test Page',
        template: 'default',
        views: 0,
        conversions: 0,
        published_at: Date.now(),
      }

      const page = await store(pageData)
      const pageId = page?.id !== undefined ? Number(page.id) : undefined

      if (!pageId) {
        throw new Error('Failed to create test page')
      }

      // Try to update with invalid data
      const updateData = {
        title: '', // Empty title should fail
        template: 'invalid', // Invalid template should fail
        views: -1, // Negative views should fail
        conversions: -1, // Negative conversions should fail
      }

      try {
        await update(pageId, updateData)
        expect(true).toBe(false) // This line should not be reached
      }
      catch (error) {
        expect(error).toBeDefined()
        expect(error instanceof Error).toBe(true)
      }
    })
  })

  describe('destroy', () => {
    it('should delete a page from the database', async () => {
      // First create a page to delete
      const author = await findOrCreateAuthor({
        name: 'Test Author',
        email: 'test.author@example.com',
      })

      const pageData = {
        author_id: author.id,
        title: 'Delete Test Page',
        template: 'default',
        views: 0,
        conversions: 0,
        published_at: Date.now(),
      }

      // Create the page
      const page = await store(pageData)
      const pageId = page?.id !== undefined ? Number(page.id) : undefined

      // Make sure we have a valid page ID before proceeding
      expect(pageId).toBeDefined()
      if (!pageId) {
        throw new Error('Failed to create test page')
      }

      // Verify the page exists
      let fetchedPage = await fetchById(pageId)
      expect(fetchedPage).toBeDefined()

      // Delete the page
      const result = await destroy(pageId)
      expect(result).toBe(true)

      // Verify the page no longer exists
      fetchedPage = await fetchById(pageId)
      expect(fetchedPage).toBeUndefined()
    })

    it('should throw an error when trying to delete a non-existent page', async () => {
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
        expect((error as Error).message).toContain(`Page with ID ${nonExistentId} not found`)
      }
    })
  })
})
