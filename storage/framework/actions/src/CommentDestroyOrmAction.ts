import type { CommentRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { Comment } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Comment Destroy',
  description: 'Comment Destroy ORM Action',
  method: 'DELETE',
  async handle(request: CommentRequestType) {
    const id = request.getParam('id')

    const model = await Comment.findOrFail(id)

    model?.delete()

    return response.json({ message: 'Model deleted!' })
  },
})
