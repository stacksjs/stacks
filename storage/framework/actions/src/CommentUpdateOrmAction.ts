import type { CommentRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { Comment } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Comment Update',
  description: 'Comment Update ORM Action',
  method: 'PATCH',
  async handle(request: CommentRequestType) {
    await request.validate()

    const id = request.getParam('id')
    const model = await Comment.findOrFail(id)

    const result = model?.update(request.all())

    return response.json(result)
  },
})
