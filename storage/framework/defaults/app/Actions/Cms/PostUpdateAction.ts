import { Action } from '@stacksjs/actions'
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

    const id = request.getParam('id')

    const data = {
      title: request.get('title'),
      excerpt: request.get('excerpt'),
      content: request.get('content'),
      status: request.get('status'),
      poster: request.get('poster'),
      updated_at: formatDate(new Date()),
    }

    const model = await posts.update(id, data)

    return response.json(model)
  },
})
