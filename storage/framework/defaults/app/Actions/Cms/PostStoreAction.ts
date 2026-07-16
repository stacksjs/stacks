import { Action } from '@stacksjs/actions'
import { authors, posts } from '@stacksjs/cms'
import { response } from '@stacksjs/router'

// Category + tag attach was removed because it referenced helpers
// (`categories.findOrCreateByName`, `findOrCreateMany`) that don't
// exist in @stacksjs/cms today. Restore them once those functions
// are added — see the Update action for the same shape.
export default new Action({
  name: 'Post Store',
  description: 'Post Store ORM Action',
  method: 'POST',
  async handle(request) {
    await request.validate()

    const user = await request.user()

    if (!user)
      return response.unauthorized('Authentication required')

    const author = await authors.findOrCreate({
      name: user.name,
      email: user.email,
    })

    const status = request.get('status') || 'draft'

    const data = {
      author_id: author.id,
      title: request.get('title'),
      excerpt: request.get('excerpt'),
      content: request.get('content'),
      status,
      poster: request.get('poster'),
      views: 0,
    }

    const model = await posts.store(data)

    return response.json(model)
  },
})
