import { describe, expect, it } from 'bun:test'

describe('CMS Module', () => {
  describe('exports', () => {
    it('should export the cms namespace object', async () => {
      const cmsModule = await import('../src/index')
      expect(cmsModule.cms).toBeDefined()
      expect(typeof cmsModule.cms).toBe('object')
    })

    it('should export cms as the default export', async () => {
      const cmsModule = await import('../src/index')
      expect(cmsModule.default).toBeDefined()
      expect(cmsModule.default).toBe(cmsModule.cms)
    })

    it('should have posts namespace on cms', async () => {
      const { cms } = await import('../src/index')
      expect(cms.posts).toBeDefined()
      expect(typeof cms.posts).toBe('object')
    })

    it('should have all expected sub-modules on cms', async () => {
      const { cms } = await import('../src/index')
      expect(cms.posts).toBeDefined()
      expect(cms.postCategories).toBeDefined()
      expect(cms.tags).toBeDefined()
      expect(cms.comments).toBeDefined()
      expect(cms.authors).toBeDefined()
      expect(cms.pages).toBeDefined()
    })

    it('should export named sub-modules individually', async () => {
      const cmsModule = await import('../src/index')
      expect(cmsModule.posts).toBeDefined()
      expect(cmsModule.tags).toBeDefined()
      expect(cmsModule.comments).toBeDefined()
      expect(cmsModule.authors).toBeDefined()
      expect(cmsModule.pages).toBeDefined()
    })
  })

  describe('Posts sub-module', () => {
    it('should export CRUD functions for posts', async () => {
      const posts = await import('../src/posts/index')
      expect(posts.fetchAll).toBeFunction()
      expect(posts.fetchById).toBeFunction()
      expect(posts.store).toBeFunction()
      expect(posts.update).toBeFunction()
      expect(posts.destroy).toBeFunction()
    })

    it('should export fetch variants', async () => {
      const posts = await import('../src/posts/index')
      expect(posts.fetchByAuthor).toBeFunction()
      expect(posts.fetchByCategory).toBeFunction()
      expect(posts.fetchByStatus).toBeFunction()
      expect(posts.fetchByMinViews).toBeFunction()
      expect(posts.fetchPublishedAfter).toBeFunction()
    })

    it('should export relationship functions', async () => {
      const posts = await import('../src/posts/index')
      expect(posts.attach).toBeFunction()
      expect(posts.detach).toBeFunction()
      expect(posts.sync).toBeFunction()
      expect(posts.bulkDestroy).toBeFunction()
    })
  })
})
