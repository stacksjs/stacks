import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { transaction } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { findRow, rowExists, rowId, timestamp } from './content-input'
import { parsePageInput, parsePublished } from './page-input'

export default new Action({
  name: 'PageUpdateAction',
  description: 'Updates a CMS page from the dashboard.',
  method: 'PATCH',
  async handle(request: RequestInstance) {
    const id = rowId(request)

    if (!id)
      return response.json({ message: 'A valid page id is required.' }, 422)

    const input = parsePageInput(request)

    if ('message' in input)
      return response.json({ message: input.message }, 422)

    try {
      const page = await transaction(async (rawTrx) => {
        const trx = rawTrx as unknown as typeof db
        if (!await rowExists('pages', id, trx))
          return null

        const current = await trx
          .selectFrom('pages')
          .select(['published_at'])
          .where('id', '=', id)
          .executeTakeFirst()
        const published = parsePublished(request.get('published'))

        await trx
          .updateTable('pages')
          .set({
            title: input.data.title,
            template: input.data.template,
            published_at: published ? current?.published_at || timestamp() : null,
            updated_at: timestamp(),
          } as any)
          .where('id', '=', id)
          .execute()

        const updated = await findRow('pages', id, trx)
        if (!updated)
          throw new Error('Updated page could not be loaded.')
        return updated
      })

      if (!page)
        return response.json({ message: 'Page not found.' }, 404)

      return response.json(page)
    }
    catch (error) {
      return dashboardOperationalError(error, 'Page could not be updated.', 'PageUpdateAction', 500)
    }
  },
})
