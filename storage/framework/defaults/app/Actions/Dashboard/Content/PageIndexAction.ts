import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'

interface PageRow {
  id: number
  title: string | null
  template: string | null
  views: number | null
  conversions: number | null
  published_at: string | null
  author_id: number | null
  created_at: string | null
  updated_at: string | null
}

/**
 * `GET /api/dashboard/pages` — backs `views/dashboard/content/pages/index.stx`.
 *
 * Reads the `pages` table via `db`. The previous `Page.orderBy(...)` call threw
 * on every request (the ORM model exposes no query methods) and the catch
 * turned that into an empty list, so a broken read looked like a CMS with no
 * pages. It also mapped `slug` and `status`, which this table does not have —
 * a page is a title, a template, and its traffic counters.
 *
 * Ordered newest-first because the page's Newest tile reads the first row.
 */
export default new Action({
  name: 'PageIndexAction',
  description: 'Returns CMS pages for the dashboard.',
  method: 'GET',
  apiResponse: true,
  async handle() {
    const rows = await db
      .selectFrom('pages')
      .selectAll()
      .orderBy('created_at', 'desc')
      .execute() as unknown as PageRow[]

    const pages = rows.map(row => ({
      id: Number(row.id),
      title: String(row.title || ''),
      template: String(row.template || 'default'),
      views: Number(row.views || 0),
      conversions: Number(row.conversions || 0),
      published_at: row.published_at || null,
      author_id: row.author_id ?? null,
      created_at: row.created_at || null,
      updated_at: row.updated_at || null,
    }))

    return { pages }
  },
})
