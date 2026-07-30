import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { response } from '@stacksjs/router'
import { randomUUIDv7 } from 'bun'
import { parseAuthorInput } from './author-input'
import { findRow, insertedId, timestamp } from './content-input'

/**
 * `POST /api/dashboard/authors` — creates a CMS author from the dashboard.
 *
 * The shared parser mirrors the `Author` model's validation contract so the
 * dashboard and generated `useApi` routes accept the same record shape.
 *
 * The email check is done here because `authors_email_name_index` is not a
 * unique index — nothing in the schema stops a duplicate.
 */
export default new Action({
  name: 'AuthorStoreAction',
  description: 'Creates a CMS author from the dashboard.',
  method: 'POST',
  async handle(request: RequestInstance) {
    const input = parseAuthorInput(request)

    if ('message' in input)
      return response.json({ message: input.message }, 422)

    const duplicate = await db
      .selectFrom('authors')
      .select(['id'])
      .where('email', '=', input.data.email)
      .executeTakeFirst()

    if (duplicate)
      return response.json({ message: 'An author with that email already exists.' }, 422)

    const now = timestamp()

    const result = await db
      .insertInto('authors')
      .values({
        uuid: randomUUIDv7(),
        name: input.data.name,
        email: input.data.email,
        bio: input.data.bio || null,
        avatar: input.data.avatar || null,
        created_at: now,
        updated_at: now,
      } as any)
      .executeTakeFirst()

    const id = insertedId(result)

    if (!id)
      return response.json({ message: 'Could not create author.' }, 500)

    return response.json(await findRow('authors', id), 201)
  },
})
