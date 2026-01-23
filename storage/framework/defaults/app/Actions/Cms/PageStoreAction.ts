import type { PageRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { authors, pages } from '@stacksjs/cms'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Page Store',
  description: 'Page Store ORM Action',
  method: 'POST',
  model: 'Page',
  async handle(request: PageRequestType) {
    await request.validate()

    const author = await authors.findOrCreate({
      name: 'Current User',
      email: 'current@user.com',
    })

    const data = {
      author_id: author.id,
      title: request.get('title'),
      template: request.get('template'),
      content: request.get('content'),
      views: 0,
      published_at: Date.now(),
    }

    const model = await pages.store(data)

    return response.json(model)
  },
})
