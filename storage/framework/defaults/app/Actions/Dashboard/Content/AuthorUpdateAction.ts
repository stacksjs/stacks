import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { isUniqueViolation, transaction } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
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

    const input = parseAuthorInput(request)

    if ('message' in input)
      return response.json({ message: input.message }, 422)

    try {
      const result = await transaction(async (rawTrx) => {
        const trx = rawTrx as unknown as typeof db
        if (!await rowExists('authors', id, trx))
          return { kind: 'not-found' } as const

        const duplicate = await trx
          .selectFrom('authors')
          .select(['id'])
          .where('email', '=', input.data.email)
          .where('id', '!=', id)
          .executeTakeFirst()

        if (duplicate)
          return { kind: 'duplicate' } as const

        await trx
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

        const author = await findRow('authors', id, trx)
        if (!author)
          throw new Error('Updated author could not be loaded.')
        return { kind: 'updated', author } as const
      })

      if (result.kind === 'not-found')
        return response.json({ message: 'Author not found.' }, 404)
      if (result.kind === 'duplicate')
        return response.json({ message: 'An author with that email already exists.' }, 422)

      return response.json(result.author)
    }
    catch (error) {
      if (isUniqueViolation(error))
        return response.json({ message: 'An author with that email already exists.' }, 422)
      return dashboardOperationalError(error, 'Author could not be updated.', 'AuthorUpdateAction', 500)
    }
  },
})
