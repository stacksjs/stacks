import { Action } from '@stacksjs/actions'
import { Post, Category, Tag } from '@stacksjs/orm'

// Mock data used when the ORM is unavailable or has no posts (e.g. dev
// dashboard with no DB seeded). Shape matches the `BlogPost` interface in
// storage/framework/defaults/views/dashboard/content/posts/index.stx so
// the page can hydrate directly from this response.
const mockPosts = [
  { id: 1, title: '10 Tips for Better Code Quality', excerpt: 'Improve your code quality with these essential tips.', slug: '10-tips-for-better-code-quality', category: 'Tutorials', tags: ['Coding', 'Best Practices'], author: 'Jane Doe', views: 12450, comments: 78, published: '2023-12-01', status: 'Published', featured: true, poster: 'https://picsum.photos/seed/1/280/160' },
  { id: 2, title: 'The Future of JavaScript Frameworks', excerpt: 'Exploring what\'s next for JS frameworks.', slug: 'future-of-javascript-frameworks', category: 'Technology', tags: ['JavaScript', 'Frameworks'], author: 'John Smith', views: 9870, comments: 124, published: '2023-11-28', status: 'Published', featured: true, poster: 'https://picsum.photos/seed/2/280/160' },
  { id: 3, title: 'Getting Started with Vue 3', excerpt: 'A comprehensive guide to Vue 3 composition API.', slug: 'getting-started-with-vue-3', category: 'Tutorials', tags: ['Vue', 'JavaScript'], author: 'Jane Doe', views: 8760, comments: 45, published: '2023-11-25', status: 'Published', featured: false, poster: 'https://picsum.photos/seed/3/280/160' },
  { id: 4, title: 'Review: Latest MacBook Pro', excerpt: 'In-depth review for developers.', slug: 'review-latest-macbook-pro', category: 'Reviews', tags: ['Hardware', 'Apple'], author: 'Michael Brown', views: 7650, comments: 92, published: '2023-11-20', status: 'Published', featured: false, poster: 'https://picsum.photos/seed/4/280/160' },
  { id: 5, title: 'Understanding Web Accessibility', excerpt: 'Why accessibility matters and how to implement it.', slug: 'understanding-web-accessibility', category: 'Tutorials', tags: ['Accessibility', 'UX'], author: 'Emily Davis', views: 6540, comments: 31, published: '2023-11-15', status: 'Published', featured: false, poster: 'https://picsum.photos/seed/5/280/160' },
  { id: 6, title: 'Introduction to TypeScript', excerpt: 'Learn the basics of TypeScript.', slug: 'introduction-to-typescript', category: 'Tutorials', tags: ['TypeScript', 'JavaScript'], author: 'Jane Doe', views: 0, comments: 0, published: '', status: 'Draft', featured: false, poster: 'https://picsum.photos/seed/6/280/160' },
  { id: 7, title: 'Building a REST API with Node.js', excerpt: 'Step-by-step guide to building REST APIs.', slug: 'building-rest-api-nodejs', category: 'Tutorials', tags: ['Node.js', 'API'], author: 'John Smith', views: 0, comments: 0, published: '', status: 'Draft', featured: false, poster: 'https://picsum.photos/seed/7/280/160' },
  { id: 8, title: 'The Impact of AI on Software Development', excerpt: 'How AI is changing software development.', slug: 'ai-impact-software-development', category: 'Technology', tags: ['AI', 'Future Tech'], author: 'Michael Brown', views: 5430, comments: 67, published: '2023-11-10', status: 'Published', featured: false, poster: 'https://picsum.photos/seed/8/280/160' },
]

const mockCategories = [
  { id: 1, name: 'Tutorials', slug: 'tutorials' },
  { id: 2, name: 'Technology', slug: 'technology' },
  { id: 3, name: 'Reviews', slug: 'reviews' },
]

const mockTags = [
  { id: 1, name: 'Coding', slug: 'coding' },
  { id: 2, name: 'JavaScript', slug: 'javascript' },
  { id: 3, name: 'Vue', slug: 'vue' },
  { id: 4, name: 'TypeScript', slug: 'typescript' },
]

function counts(posts: Array<{ status: string }>) {
  return {
    publishedCount: posts.filter(p => p.status.toLowerCase() === 'published').length,
    draftCount: posts.filter(p => p.status.toLowerCase() === 'draft').length,
    scheduledCount: posts.filter(p => p.status.toLowerCase() === 'scheduled').length,
  }
}

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

      // Empty result from a real ORM still falls through to mock data so
      // the dev dashboard always has something to render.
      if (!allPosts || allPosts.length === 0) {
        return {
          posts: mockPosts,
          categories: mockCategories,
          tags: mockTags,
          ...counts(mockPosts),
        }
      }

      const posts = allPosts.map((p, idx) => ({
        id: Number(p.get('id') || idx + 1),
        title: String(p.get('title') || ''),
        excerpt: String(p.get('excerpt') || ''),
        slug: String(p.get('slug') || ''),
        category: String(p.get('category') || ''),
        tags: Array.isArray(p.get('tags')) ? p.get('tags') as string[] : [],
        author: String(p.get('author') || ''),
        views: Number(p.get('views') || 0),
        comments: Number(p.get('comments') || 0),
        published: String(p.get('published_at') || p.get('published') || p.get('created_at') || ''),
        status: String(p.get('status') || 'Draft'),
        featured: Boolean(p.get('featured')),
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

      return { posts, categories, tags, ...counts(posts) }
    }
    catch {
      return {
        posts: mockPosts,
        categories: mockCategories,
        tags: mockTags,
        ...counts(mockPosts),
      }
    }
  },
})
