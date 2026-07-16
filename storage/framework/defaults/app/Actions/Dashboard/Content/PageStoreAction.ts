import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { response } from '@stacksjs/router'
import { findRow, insertedId, str, timestamp } from './content-input'

/**
 * `POST /api/dashboard/pages` — creates a CMS page from the dashboard.
 *
 * No `uuid` is written: unlike `posts` / `authors` / `tags`, the `pages` table
 * has no uuid column even though the model declares the `useUuid` trait.
 *
 * `published_at` stays null — the dialog has no publish control, and the page's
 * Published column falls back to `created_at`.
 */
export default new Action({
  name: 'PageStoreAction',
  description: 'Creates a CMS page from the dashboard.',
  method: 'POST',
  async handle(request: RequestInstance) {
    const title = str(request.get('title')).trim()
    const template = str(request.get('template')).trim() || 'default'

    if (!title)
      return response.json({ message: 'Title is required.' }, 422)

    const now = timestamp()

    const result = await db
      .insertInto('pages')
      .values({
        title,
        template,
        views: 0,
        conversions: 0,
        published_at: null,
        created_at: now,
        updated_at: now,
      } as any)
      .executeTakeFirst()

    const id = insertedId(result)

    if (!id)
      return response.json({ message: 'Could not create page.' }, 500)

    return response.json(await findRow('pages', id), 201)
  },
})
