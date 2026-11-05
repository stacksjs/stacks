import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { parsePageListQuery, readPageListPage } from './page-list'

/**
 * `GET /api/dashboard/pages` — backs `views/dashboard/content/pages/index.stx`.
 *
 * Reads one page of the `pages` table, searched, sorted and counted by the
 * database (`page-list.ts`, stacksjs/stacks#3192). The previous
 * `Page.orderBy(...)` call threw on every request (the ORM model exposes no
 * query methods) and the catch turned that into an empty list, so a broken read looked like a CMS with no
 * pages. It also mapped `slug` and `status`, which this table does not have —
 * a page is a title, a template, and its traffic counters.
 *
 * Newest first by default. The Newest tile reads `newestTitle`, which is the
 * newest page whatever the search or sort.
 */
export default new Action({
  name: 'PageIndexAction',
  description: 'Returns CMS pages for the dashboard.',
  method: 'GET',
  apiResponse: true,
  async handle(request: RequestInstance) {
    const query = parsePageListQuery(key => request.get<unknown>(key, ''))
    if ('error' in query)
      return response.json({ message: query.error }, 422)

    try {
      const result = await readPageListPage(query)

      const pages = result.rows.map(row => ({
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

      return {
        pages,
        total: result.total,
        page: result.page,
        perPage: query.perPage,
        allCount: result.allCount,
        totalViews: result.totalViews,
        totalConversions: result.totalConversions,
        newestTitle: result.newestTitle,
      }
    }
    catch (error) {
      return dashboardOperationalError(error, 'Pages could not be loaded.', 'PageIndexAction')
    }
  },
})
