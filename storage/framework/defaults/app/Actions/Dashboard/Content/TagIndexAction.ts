import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'

interface TagRow {
  id: number
  name: string | null
  slug: string | null
  description: string | null
  post_count: number | null
  color: string | null
  created_at: string | null
  updated_at: string | null
}

/**
 * `GET /api/dashboard/tags` — backs `views/dashboard/content/tags/index.stx`.
 *
 * Reads the `tags` table via `db`. The previous `Tag.all()` call threw on every
 * request (the ORM model exposes no query methods) and the catch turned that
 * into an empty list, so a broken read looked like a CMS with no tags. It also
 * returned only `{ name, count }`, while the page renders id, slug, and
 * description.
 */
export default new Action({
  name: 'TagIndexAction',
  description: 'Returns CMS tags for the dashboard.',
  method: 'GET',
  apiResponse: true,
  async handle() {
    const rows = await db
      .selectFrom('tags')
      .selectAll()
      .orderBy('created_at', 'desc')
      .execute() as unknown as TagRow[]

    const tags = rows.map(row => ({
      id: Number(row.id),
      name: String(row.name || ''),
      slug: String(row.slug || ''),
      description: String(row.description || ''),
      color: String(row.color || ''),
      post_count: Number(row.post_count || 0),
      created_at: row.created_at || null,
      updated_at: row.updated_at || null,
    }))

    return { tags }
  },
})
