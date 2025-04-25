import type { CommentablesRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { comments } from '@stacksjs/cms'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Comment Index',
  description: 'Comment Index ORM Action',
  method: 'GET',
  async handle(request: CommentablesRequestType) {
    const commentables_id = request.getParam('commentables_id')
    const commentables_type = request.getParam('commentables_type')

    const results = await comments.fetchCommentsByCommentables(Number(commentables_id), commentables_type)

    return response.json(results)
  },
})
