import type { CommentableRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { comments } from '@stacksjs/cms'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Comment Update',
  description: 'Comment Update ORM Action',
  method: 'PATCH',
  async handle(request: CommentableRequestType) {
    await request.validate()

    const id = request.getParam('id')
    const model = await comments.update(id, request)

    return response.json(model)
  },
})
