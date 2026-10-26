import { Action } from '@stacksjs/actions/runtime'
import { posts } from '@stacksjs/cms'
import { formatDate } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

// Category + tag sync was removed because it referenced helpers
// (`categories.findOrCreateByName`, `findOrCreateMany`) that don't
// exist in @stacksjs/cms today. Restore once those functions are
// added.
export default new Action({
  name: 'Post Update',
  description: 'Post Update ORM Action',
  method: 'PATCH',
  async handle(request) {
    await request.validate()

    const id = Number(request.getParam('id'))

    // Only the fields the request sent: an absent one copied through
    // request.get() reached the query as undefined, which binds NULL and
    // erased the stored value (stacksjs/stacks#3010).
    const data = {
      ...request.only(['title', 'excerpt', 'content', 'status', 'poster']),
      updated_at: formatDate(new Date()),
    }

    const model = await posts.update(id, data)

    return response.json(model)
  },
})
