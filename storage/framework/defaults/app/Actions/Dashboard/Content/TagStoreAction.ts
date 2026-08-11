import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { isUniqueViolation, transaction } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { randomUUIDv7 } from 'bun'
import { dashboardOperationalError } from '../dashboard-response'
import { findRow, insertedId, slugify, str, timestamp } from './content-input'

/**
 * `POST /api/dashboard/tags` — creates a CMS tag from the dashboard.
 *
 * The duplicate check provides a clear validation response before the model's
 * unique constraints enforce the same invariant.
 */
export default new Action({
  name: 'TagStoreAction',
  description: 'Creates a CMS tag from the dashboard.',
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
      const tag = await transaction(async (rawTrx) => {
        const trx = rawTrx as unknown as typeof db
        const duplicate = await trx
          .selectFrom('tags')
          .select(['id'])
          .where('slug', '=', slug)
          .orWhere('name', '=', name)
          .executeTakeFirst()

        if (duplicate)
          return null

        const now = timestamp()

        const result = await trx
          .insertInto('tags')
          .values({
            uuid: randomUUIDv7(),
            name,
            slug,
            description,
            created_at: now,
            updated_at: now,
          } as any)
          .executeTakeFirst()

        const id = insertedId(result)

        if (!id)
          throw new Error('Tag insert did not return an id.')

        const created = await findRow('tags', id, trx)
        if (!created)
          throw new Error('Created tag could not be loaded.')
        return created
      })

      if (!tag)
        return response.json({ message: 'A tag with that name or slug already exists.' }, 422)

      return response.json(tag, 201)
    }
    catch (error) {
      if (isUniqueViolation(error))
        return response.json({ message: 'A tag with that name or slug already exists.' }, 422)
      return dashboardOperationalError(error, 'Tag could not be created.', 'TagStoreAction', 500)
    }
  },
})
