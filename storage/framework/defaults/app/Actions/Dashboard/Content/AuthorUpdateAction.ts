import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { response } from '@stacksjs/router'
import { parseAuthorInput } from './author-input'
import { findRow, rowExists, rowId, timestamp } from './content-input'

export default new Action({
  name: 'AuthorUpdateAction',
  description: 'Updates a CMS author from the dashboard.',
  method: 'PATCH',
  async handle(request: RequestInstance) {
    const id = rowId(request)

    if (!id)
      return response.json({ message: 'A valid author id is required.' }, 422)

    if (!await rowExists('authors', id))
      return response.json({ message: 'Author not found.' }, 404)

    const input = parseAuthorInput(request)

    if ('message' in input)
      return response.json({ message: input.message }, 422)

    const duplicate = await db
      .selectFrom('authors')
      .select(['id'])
      .where('email', '=', input.data.email)
      .where('id', '!=', id)
      .executeTakeFirst()

    if (duplicate)
      return response.json({ message: 'An author with that email already exists.' }, 422)

    await db
      .updateTable('authors')
      .set({
        name: input.data.name,
        email: input.data.email,
        bio: input.data.bio || null,
        avatar: input.data.avatar || null,
        updated_at: timestamp(),
      } as any)
      .where('id', '=', id)
      .execute()

    return response.json(await findRow('authors', id))
  },
})
