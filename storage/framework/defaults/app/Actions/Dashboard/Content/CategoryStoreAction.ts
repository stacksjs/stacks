import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { response } from '@stacksjs/router'
import { randomUUIDv7 } from 'bun'
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

    const duplicate = await db
      .selectFrom('categories')
      .select(['id'])
      .where('slug', '=', slug)
      .executeTakeFirst()

    if (duplicate)
      return response.json({ message: 'A category with that slug already exists.' }, 422)

    const now = timestamp()
    const displayOrder = await db
      .selectFrom('categories')
      .select(db.fn.max('display_order').as('max_display_order'))
      .executeTakeFirst()

    const result = await db
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
      return response.json({ message: 'Could not create category.' }, 500)

    return response.json(await findRow('categories', id), 201)
  },
})
