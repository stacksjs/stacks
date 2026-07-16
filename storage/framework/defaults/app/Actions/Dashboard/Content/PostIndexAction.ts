import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'

interface PostRow {
  id: number
  title: string
  excerpt: string | null
  content: string | null
  poster: string | null
  status: string | null
  views: number | null
  published_at: string | null
  created_at: string | null
  updated_at: string | null
  author_id: number | null
  is_featured: number | null
}

// `status` is stored lowercase (the posts table has a CHECK constraint on
// 'published' | 'draft' | 'archived'), but older rows and hand-written seeds
// have been seen with 'Draft'/'Published'. Normalize on read so the dashboard
// filter and badge styling only ever deal with one casing.
function normalizeStatus(status: string | null): string {
  const value = String(status || 'draft').toLowerCase()

  return value === 'published' || value === 'archived' ? value : 'draft'
}

function counts(posts: Array<{ status: string }>) {
  return {
    publishedCount: posts.filter(p => p.status === 'published').length,
    draftCount: posts.filter(p => p.status === 'draft').length,
    archivedCount: posts.filter(p => p.status === 'archived').length,
  }
}

/**
 * `GET /api/dashboard/posts` — backs `views/dashboard/content/posts/index.stx`.
 *
 * Reads straight from the `posts` table via `db` rather than the ORM model:
 * `Post` from `@stacksjs/orm` exposes no query methods today, so the previous
 * `Post.orderBy(...)` call threw on every request.
 *
 * There is deliberately no mock-data fallback. This action used to catch every
 * error and serve placeholder rows, which made a page that was 404ing against
 * an unregistered endpoint look like it was working. A failure here must
 * surface as a failure.
 */
export default new Action({
  name: 'PostIndexAction',
  description: 'Returns CMS posts for the dashboard.',
  method: 'GET',
  apiResponse: true,
  async handle() {
    const rows = await db
      .selectFrom('posts')
      .selectAll()
      .orderBy('created_at', 'desc')
      .execute() as unknown as PostRow[]

    const posts = rows.map(row => ({
      id: Number(row.id),
      title: String(row.title || ''),
      excerpt: String(row.excerpt || ''),
      content: String(row.content || ''),
      poster: String(row.poster || ''),
      status: normalizeStatus(row.status),
      views: Number(row.views || 0),
      published_at: row.published_at || null,
      created_at: row.created_at || null,
      updated_at: row.updated_at || null,
      author_id: row.author_id ?? null,
      featured: Boolean(row.is_featured),
    }))

    const [categories, tags] = await Promise.all([
      db.selectFrom('categories').select(['id', 'name', 'slug']).execute(),
      db.selectFrom('tags').select(['id', 'name', 'slug']).execute(),
    ])

    return { posts, categories, tags, ...counts(posts) }
  },
})
