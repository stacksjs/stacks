import type { CommentablesRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { comments } from '@stacksjs/cms'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Comment Show',
  description: 'Comment Show ORM Action',
  method: 'GET',
  async handle(request: CommentablesRequestType) {
    const id = request.getParam('id')

    const model = await comments.fetchCommentById(id)

    return response.json(model)
  },
})
