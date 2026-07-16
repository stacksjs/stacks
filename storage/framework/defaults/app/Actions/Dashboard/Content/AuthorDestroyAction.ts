import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { response } from '@stacksjs/router'
import { rowExists, rowId, timestamp } from './content-input'

/**
 * `DELETE /api/dashboard/authors/{id}` — deletes a CMS author from the dashboard.
 *
 * Posts written by the author are kept and unassigned rather than deleted:
 * losing an author should not silently take their posts with it. The schema
 * declares no foreign key on `posts.author_id`, so without this the rows would
 * be left pointing at an id that no longer resolves.
 */
export default new Action({
  name: 'AuthorDestroyAction',
  description: 'Deletes a CMS author from the dashboard.',
  method: 'DELETE',
  async handle(request: RequestInstance) {
    const id = rowId(request)

    if (!id)
      return response.json({ message: 'A valid author id is required.' }, 422)

    if (!await rowExists('authors', id))
      return response.json({ message: 'Author not found.' }, 404)

    await db
      .updateTable('posts')
      .set({ author_id: null, updated_at: timestamp() } as any)
      .where('author_id', '=', id)
      .execute()

    await db.deleteFrom('authors').where('id', '=', id).execute()

    return response.json({ message: 'Author deleted.', id })
  },
})
