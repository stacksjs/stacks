import { Action } from '@stacksjs/actions'
import { Post, Category, Tag } from '@stacksjs/orm'

export default new Action({
  name: 'PostIndexAction',
  description: 'Returns posts data for the dashboard.',
  method: 'GET',
  async handle() {
    try {
      const [allPosts, allCategories, allTags] = await Promise.all([
        Post.orderBy('created_at', 'desc').get(),
        Category.all(),
        Tag.all(),
      ])

      const posts = allPosts.map(p => ({
        id: Number(p.get('id')),
        title: String(p.get('title') || ''),
        content: String(p.get('content') || ''),
        excerpt: String(p.get('excerpt') || ''),
        status: String(p.get('status') || 'draft'),
        author: String(p.get('author') || ''),
        date: String(p.get('created_at') || ''),
        views: Number(p.get('views') || 0),
        poster: String(p.get('poster') || ''),
      }))

      const categories = allCategories.map(c => ({
        id: Number(c.get('id')),
        name: String(c.get('name') || ''),
        slug: String(c.get('slug') || ''),
      }))

      const tags = allTags.map(t => ({
        id: Number(t.get('id')),
        name: String(t.get('name') || ''),
        slug: String(t.get('slug') || ''),
      }))

      const publishedCount = posts.filter(p => p.status === 'published').length
      const draftCount = posts.filter(p => p.status === 'draft').length
      const scheduledCount = posts.filter(p => p.status === 'scheduled').length

      return { posts, categories, tags, publishedCount, draftCount, scheduledCount }
    }
    catch {
      return {
        posts: [],
        categories: [],
        tags: [],
        publishedCount: 0,
        draftCount: 0,
        scheduledCount: 0,
      }
    }
  },
})
