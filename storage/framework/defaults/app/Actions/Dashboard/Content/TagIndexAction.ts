import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { dashboardOperationalError } from '../dashboard-response'

interface TagRow {
  id: number
  name: string | null
  slug: string | null
  description: string | null
  color: string | null
  created_at: string | null
  updated_at: string | null
}

interface TagCountRow {
  tag_id: number
  count: number
}

/**
 * `GET /api/dashboard/tags` — backs `views/dashboard/content/tags/index.stx`.
 *
 * Reads tag records and derives assignment counts from the canonical pivot
 * table so the dashboard never depends on stale denormalized counters.
 */
export default new Action({
  name: 'TagIndexAction',
  description: 'Returns CMS tags for the dashboard.',
  method: 'GET',
  apiResponse: true,
  async handle() {
    try {
      const [rows, countRows] = await Promise.all([
        db
          .selectFrom('tags')
          .select(['id', 'name', 'slug', 'description', 'color', 'created_at', 'updated_at'])
          .orderBy('created_at', 'desc')
          .execute() as unknown as Promise<TagRow[]>,
        db
          .selectFrom('taggable_models')
          .select(['tag_id', db.fn.count('taggable_id').as('count')])
          .where('taggable_type', '=', 'posts')
          .groupBy('tag_id')
          .execute() as unknown as Promise<TagCountRow[]>,
      ])
      const countByTag = new Map(countRows.map(row => [Number(row.tag_id), Number(row.count)]))

      const tags = rows.map(row => ({
        id: Number(row.id),
        name: String(row.name || ''),
        slug: String(row.slug || ''),
        description: String(row.description || ''),
        color: String(row.color || ''),
        post_count: countByTag.get(Number(row.id)) || 0,
        created_at: row.created_at || null,
        updated_at: row.updated_at || null,
      }))

      return { tags }
    }
    catch (error) {
      return dashboardOperationalError(error, 'Tags could not be loaded.', 'TagIndexAction')
    }
  },
})
