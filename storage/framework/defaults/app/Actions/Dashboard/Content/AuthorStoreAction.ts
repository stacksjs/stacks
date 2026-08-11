import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { isUniqueViolation, transaction } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { randomUUIDv7 } from 'bun'
import { dashboardOperationalError } from '../dashboard-response'
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

    try {
      const author = await transaction(async (rawTrx) => {
        const trx = rawTrx as unknown as typeof db
        const duplicate = await trx
          .selectFrom('authors')
          .select(['id'])
          .where('email', '=', input.data.email)
          .executeTakeFirst()

        if (duplicate)
          return null

        const now = timestamp()

        const result = await trx
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
          throw new Error('Author insert did not return an id.')

        const created = await findRow('authors', id, trx)
        if (!created)
          throw new Error('Created author could not be loaded.')
        return created
      })

      if (!author)
        return response.json({ message: 'An author with that email already exists.' }, 422)

      return response.json(author, 201)
    }
    catch (error) {
      if (isUniqueViolation(error))
        return response.json({ message: 'An author with that email already exists.' }, 422)
      return dashboardOperationalError(error, 'Author could not be created.', 'AuthorStoreAction', 500)
    }
  },
})
