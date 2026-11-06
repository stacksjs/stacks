import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { db } from '@stacksjs/database/runtime'
import { transaction } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { findRow, insertedId, slugify, str, timestamp } from './content-input'

/**
 * `POST /api/dashboard/categories` — creates a CMS category from the dashboard.
 *
 * The dialog pre-fills the slug from the name but lets it be edited or cleared,
 * so an empty slug is derived here rather than rejected.
 */
export default new Action({
  name: 'CategoryStoreAction',
  description: 'Creates a CMS category from the dashboard.',
  method: 'POST',
  async handle(request: RequestInstance) {
    const name = str(request.get('name')).trim()
    const description = str(request.get('description'))
    const slug = slugify(str(request.get('slug')) || name)

    if (!name)
      return response.json({ message: 'Name is required.' }, 422)

    if (!slug)
      return response.json({ message: 'Slug could not be derived from the name; enter one.' }, 422)

    try {
      const category = await transaction(async (rawTrx) => {
        const trx = rawTrx as unknown as typeof db
        const duplicate = await trx
          .selectFrom('categorizables').where('categorizable_type', '=', 'posts')
          .select(['id'])
          .where('slug', '=', slug)
          .executeTakeFirst()

        if (duplicate)
          return null

        const now = timestamp()
        const result = await trx
          .insertInto('categorizables')
          .values({
            name,
            slug,
            description,
            // A real boolean: on PostgreSQL the column is boolean and refuses 1.
            is_active: true,
            categorizable_type: 'posts',
            categorizable_id: 0,
            created_at: now,
            updated_at: now,
          } as any)
          // PostgreSQL reports no insert id without RETURNING (#3004).
          .returningAll()
          .executeTakeFirst()

        const id = insertedId(result)

        if (!id)
          throw new Error('Category insert did not return an id.')

        const created = await findRow('categorizables', id, trx)
        if (!created)
          throw new Error('Created category could not be loaded.')
        return created
      })

      if (!category)
        return response.json({ message: 'A category with that slug already exists.' }, 422)

      return response.json(category, 201)
    }
    catch (error) {
      return dashboardOperationalError(error, 'Category could not be created.', 'CategoryStoreAction', 500)
    }
  },
})
