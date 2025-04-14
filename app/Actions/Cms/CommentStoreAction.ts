import type { CommentRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { Comment } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Comment Store',
  description: 'Comment Store ORM Action',
  method: 'POST',
  async handle(request: CommentRequestType) {
    await request.validate()
    const model = await Comment.create(request.all())

    return response.json(model)
  },
})
