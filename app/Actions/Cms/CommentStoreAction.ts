import { Action } from '@stacksjs/actions'
import { comments } from '@stacksjs/cms'
import { CommentableRequestType } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Comment Store',
  description: 'Comment Store ORM Action',
  method: 'POST',
  async handle(request: CommentableRequestType) {
    await request.validate()
    const model = await comments.store(request)

    return response.json(model)
  },
})
