import type { CommentablesRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { comments } from '@stacksjs/cms'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Comment Store',
  description: 'Comment Store ORM Action',
  method: 'POST',
  async handle(request: CommentablesRequestType) {
    await request.validate()

    const data = {
      title: request.get('title'),
      body: request.get('body'),
      status: request.get('status'),
      commentables_id: request.get<number>('commentables_id'),
      commentables_type: request.get<string>('commentables_type'),
      user_id: request.get<number>('user_id'),
    }

    const model = await comments.store(data)

    return response.json(model)
  },
})
