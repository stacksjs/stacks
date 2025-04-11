import type { CommentRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { Comment } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Comment Show',
  description: 'Comment Show ORM Action',
  method: 'GET',
  async handle(request: CommentRequestType) {
    const id = request.getParam('id')

    const model = await Comment.findOrFail(id)

    return response.json(model)
  },
})
