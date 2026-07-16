import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { response } from '@stacksjs/router'
import { randomUUIDv7 } from 'bun'
import { findRow, insertedId, slugify, str, timestamp } from './content-input'

/**
 * `POST /api/dashboard/tags` — creates a CMS tag from the dashboard.
 *
 * The `Tag` model declares `name` and `slug` unique but the table carries no
 * unique constraint, so the duplicate check has to happen here.
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

    const duplicate = await db
      .selectFrom('tags')
      .select(['id'])
      .where('slug', '=', slug)
      .executeTakeFirst()

    if (duplicate)
      return response.json({ message: 'A tag with that slug already exists.' }, 422)

    const now = timestamp()

    const result = await db
      .insertInto('tags')
      .values({
        uuid: randomUUIDv7(),
        name,
        slug,
        description,
        post_count: 0,
        created_at: now,
        updated_at: now,
      } as any)
      .executeTakeFirst()

    const id = insertedId(result)

    if (!id)
      return response.json({ message: 'Could not create tag.' }, 500)

    return response.json(await findRow('tags', id), 201)
  },
})
