import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'

interface CategoryRow {
  id: number
  name: string | null
  slug: string | null
  description: string | null
  is_active: number | null
  created_at: string | null
  updated_at: string | null
}

/**
 * `GET /api/dashboard/categories` — backs `views/dashboard/content/categories/index.stx`.
 *
 * Reads the `categories` table via `db`. The previous `Category.all()` call
 * threw on every request (the ORM model exposes no query methods) and the catch
 * turned that into an empty list, so a broken read was indistinguishable from a
 * CMS with no categories. It also mapped `parent_id` and `post_count`, neither
 * of which this table has.
 *
 * Note this is the same `categories` table the commerce `Category` model owns —
 * CMS and commerce categories are not separated in the schema today.
 */
export default new Action({
  name: 'CategoryIndexAction',
  description: 'Returns CMS categories for the dashboard.',
  method: 'GET',
  apiResponse: true,
  async handle() {
    const rows = await db
      .selectFrom('categories')
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
  },
})
