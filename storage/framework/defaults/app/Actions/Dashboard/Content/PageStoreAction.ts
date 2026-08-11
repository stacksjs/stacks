import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { transaction } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { randomUUIDv7 } from 'bun'
import { dashboardOperationalError } from '../dashboard-response'
import { findRow, insertedId, timestamp } from './content-input'
import { parsePageInput, parsePublished } from './page-input'

/**
 * `POST /api/dashboard/pages` — creates a CMS page from the dashboard.
 *
 * New pages are drafts unless the dashboard explicitly submits `published`;
 * published records receive the same SQL-style timestamp as other CMS writes.
 */
export default new Action({
  name: 'PageStoreAction',
  description: 'Creates a CMS page from the dashboard.',
  method: 'POST',
  async handle(request: RequestInstance) {
    const input = parsePageInput(request)

    if ('message' in input)
      return response.json({ message: input.message }, 422)

    try {
      const page = await transaction(async (rawTrx) => {
        const trx = rawTrx as unknown as typeof db
        const now = timestamp()

        const result = await trx
          .insertInto('pages')
          .values({
            uuid: randomUUIDv7(),
            title: input.data.title,
            template: input.data.template,
            views: 0,
            conversions: 0,
            published_at: parsePublished(request.get('published')) ? now : null,
            created_at: now,
            updated_at: now,
          } as any)
          .executeTakeFirst()

        const id = insertedId(result)

        if (!id)
          throw new Error('Page insert did not return an id.')

        const created = await findRow('pages', id, trx)
        if (!created)
          throw new Error('Created page could not be loaded.')
        return created
      })

      return response.json(page, 201)
    }
    catch (error) {
      return dashboardOperationalError(error, 'Page could not be created.', 'PageStoreAction', 500)
    }
  },
})
