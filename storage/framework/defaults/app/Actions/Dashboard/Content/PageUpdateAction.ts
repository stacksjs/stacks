import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { response } from '@stacksjs/router'
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

    if (!await rowExists('pages', id))
      return response.json({ message: 'Page not found.' }, 404)

    const input = parsePageInput(request)

    if ('message' in input)
      return response.json({ message: input.message }, 422)

    const current = await db
      .selectFrom('pages')
      .select(['published_at'])
      .where('id', '=', id)
      .executeTakeFirst()
    const published = parsePublished(request.get('published'))

    await db
      .updateTable('pages')
      .set({
        title: input.data.title,
        template: input.data.template,
        published_at: published ? current?.published_at || timestamp() : null,
        updated_at: timestamp(),
      } as any)
      .where('id', '=', id)
      .execute()

    return response.json(await findRow('pages', id))
  },
})
