import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { transaction } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { randomUUIDv7 } from 'bun'
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
          .selectFrom('categories')
          .select(['id'])
          .where('slug', '=', slug)
          .executeTakeFirst()

        if (duplicate)
          return null

        const now = timestamp()
        const displayOrder = await trx
          .selectFrom('categories')
          .select(db.fn.max('display_order').as('max_display_order'))
          .executeTakeFirst()

        const result = await trx
          .insertInto('categories')
          .values({
            uuid: randomUUIDv7(),
            name,
            slug,
            description,
            is_active: 1,
            display_order: Number(displayOrder?.max_display_order || 0) + 1,
            created_at: now,
            updated_at: now,
          } as any)
          .executeTakeFirst()

        const id = insertedId(result)

        if (!id)
          throw new Error('Category insert did not return an id.')

        const created = await findRow('categories', id, trx)
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
