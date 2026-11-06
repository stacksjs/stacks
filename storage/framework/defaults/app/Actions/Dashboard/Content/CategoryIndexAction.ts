import { Action } from '@stacksjs/actions/runtime'
import { db } from '@stacksjs/database/runtime'
import { dashboardOperationalError } from '../dashboard-response'

interface CategoryRow {
  id: number
  name: string | null
  slug: string | null
  description: string | null
  is_active: number | null
  created_at: string | null
  updated_at: string | null
}

/** The CMS catalog owns categorizables; commerce's categories have a separate id space. */
export default new Action({
  name: 'CategoryIndexAction',
  description: 'Returns CMS categories for the dashboard.',
  method: 'GET',
  apiResponse: true,
  async handle() {
    try {
      const rows = await db
        .selectFrom('categorizables').where('categorizable_type', '=', 'posts')
        .selectAll()
        .orderBy('created_at', 'desc')
        .execute() as unknown as CategoryRow[]

      const categories = rows.map(row => ({
        id: Number(row.id),
        name: String(row.name || ''),
        slug: String(row.slug || ''),
        description: String(row.description || ''),
        is_active: row.is_active == null ? true : Boolean(row.is_active),
        created_at: row.created_at || null,
        updated_at: row.updated_at || null,
      }))

      return { categories }
    }
    catch (error) {
      return dashboardOperationalError(error, 'Categories could not be loaded.', 'CategoryIndexAction')
    }
  },
})
