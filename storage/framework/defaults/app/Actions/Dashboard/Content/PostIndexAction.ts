import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { db } from '@stacksjs/database/runtime'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { parsePostListQuery, readPostPage } from './post-list'

interface PivotRow {
  relatedId: number
  postId: number
}

function relatedIdsByPost(rows: PivotRow[]): Map<number, number[]> {
  const idsByPost = new Map<number, number[]>()

  for (const row of rows) {
    const postId = Number(row.postId)
    const relatedId = Number(row.relatedId)
    idsByPost.set(postId, [...(idsByPost.get(postId) || []), relatedId])
  }

  return idsByPost
}

// `status` is stored lowercase (the posts table has a CHECK constraint on
// 'published' | 'draft' | 'archived'), but older rows and hand-written seeds
// have been seen with 'Draft'/'Published'. Normalize on read so the dashboard
// filter and badge styling only ever deal with one casing.
function normalizeStatus(status: string | null): string {
  const value = String(status || 'draft').toLowerCase()

  return value === 'published' || value === 'archived' ? value : 'draft'
}

/**
 * `GET /api/dashboard/posts` — backs `views/dashboard/content/posts/index.stx`.
 *
 * Reads one page of posts, searched, filtered, sorted and counted by the
 * database (`post-list.ts`, stacksjs/stacks#3191), and the category and tag
 * links for that page only, grouped in maps to avoid relation N+1 queries.
 * Writes use the same model-declared pivots on one native database
 * transaction.
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
  async handle(request: RequestInstance) {
    const query = parsePostListQuery(key => request.get<unknown>(key, ''))
    if ('error' in query)
      return response.json({ message: query.error }, 422)

    try {
      const page = await readPostPage(query)

      const posts = page.rows.map(row => ({
        id: Number(row.id),
        title: String(row.title || ''),
        excerpt: String(row.excerpt || ''),
        preview: String(row.preview || ''),
        poster: String(row.poster || ''),
        status: normalizeStatus(row.status),
        views: Number(row.views || 0),
        published_at: row.published_at || null,
        created_at: row.created_at || null,
        updated_at: row.updated_at || null,
        author_id: row.author_id ?? null,
        featured: Boolean(row.is_featured),
      }))

      const postIds = posts.map(post => post.id)
      const [categories, tags, authors, categoryRelations, tagRelations] = await Promise.all([
        db.selectFrom('categorizables').where('categorizable_type', '=', 'posts').select(['id', 'name', 'slug']).orderBy('name').execute(),
        db.selectFrom('tags').select(['id', 'name', 'slug']).orderBy('name').execute(),
        db.selectFrom('authors').select(['id', 'name', 'email']).orderBy('name').execute(),
        postIds.length
          ? db.selectFrom('categorizable_models')
              .whereIn('categorizable_id', postIds)
              .where('categorizable_type', '=', 'posts')
              .select(['category_id as relatedId', 'categorizable_id as postId'])
              .execute() as unknown as Promise<PivotRow[]>
          : Promise.resolve([]),
        postIds.length
          ? db.selectFrom('taggable_models')
              .whereIn('taggable_id', postIds)
              .where('taggable_type', '=', 'posts')
              .select(['tag_id as relatedId', 'taggable_id as postId'])
              .execute() as unknown as Promise<PivotRow[]>
          : Promise.resolve([]),
      ])

      const categoryIdsByPost = relatedIdsByPost(categoryRelations)
      const tagIdsByPost = relatedIdsByPost(tagRelations)
      const withRelations = posts.map(post => ({
        ...post,
        categoryIds: categoryIdsByPost.get(post.id) || [],
        tagIds: tagIdsByPost.get(post.id) || [],
      }))

      return {
        posts: withRelations,
        categories,
        tags,
        authors,
        total: page.total,
        page: page.page,
        perPage: query.perPage,
        allCount: page.allCount,
        publishedCount: page.publishedCount,
        draftCount: page.draftCount,
        archivedCount: page.archivedCount,
        totalViews: page.totalViews,
      }
    }
    catch (error) {
      return dashboardOperationalError(error, 'Posts could not be loaded.', 'PostIndexAction')
    }
  },
})
