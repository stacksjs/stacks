import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { response } from '@stacksjs/router'
import { randomUUIDv7 } from 'bun'
import { findRow, insertedId, str, timestamp } from './content-input'

/**
 * `POST /api/dashboard/authors` — creates a CMS author from the dashboard.
 *
 * Does not reuse `Actions/Cms/AuthorStoreAction`: that runs the `Author` model
 * validation, which requires a name of at least five characters and rejects the
 * empty bio/avatar the dashboard dialog submits.
 *
 * The email check is done here because `authors_email_name_index` is not a
 * unique index — nothing in the schema stops a duplicate.
 */
export default new Action({
  name: 'AuthorStoreAction',
  description: 'Creates a CMS author from the dashboard.',
  method: 'POST',
  async handle(request: RequestInstance) {
    const name = str(request.get('name')).trim()
    const email = str(request.get('email')).trim()

    if (!name)
      return response.json({ message: 'Name is required.' }, 422)

    if (!email)
      return response.json({ message: 'Email is required.' }, 422)

    const duplicate = await db
      .selectFrom('authors')
      .select(['id'])
      .where('email', '=', email)
      .executeTakeFirst()

    if (duplicate)
      return response.json({ message: 'An author with that email already exists.' }, 422)

    const now = timestamp()

    const result = await db
      .insertInto('authors')
      .values({
        uuid: randomUUIDv7(),
        name,
        email,
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
