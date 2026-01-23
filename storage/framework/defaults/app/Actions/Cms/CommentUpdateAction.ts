import type { CommentablesRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { comments } from '@stacksjs/cms'
import { response } from '@stacksjs/router'
import { schema } from '@stacksjs/validation'

export default new Action({
  name: 'Comment Update',
  description: 'Comment Update ORM Action',
  method: 'PATCH',
  async handle(request: CommentablesRequestType) {
    await request.validate({
      title: {
        rule: schema.string(),
        message: {
          title: 'Title is required',
        },
      },
      body: {
        rule: schema.string(),
        message: {
          body: 'Body is required',
        },
      },
    })
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
