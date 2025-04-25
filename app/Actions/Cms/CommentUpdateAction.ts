import type { commentablesRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { comments } from '@stacksjs/cms'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Comment Update',
  description: 'Comment Update ORM Action',
  method: 'PATCH',
  async handle(request: commentablesRequestType) {
    await request.validate()

    const id = request.getParam('id')

    const data = {
      title: request.get('title'),
      body: request.get('body'),
      status: request.get('status'),
    }

    const model = await comments.update(id, data)

    return response.json(model)
  },
})
