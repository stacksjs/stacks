import type { CommentableRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { comments } from '@stacksjs/cms'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Comment Store',
  description: 'Comment Store ORM Action',
  method: 'POST',
  async handle(request: CommentableRequestType) {
    await request.validate()

    const data = {
      title: request.get('title') as string,
      body: request.get('body') as string,
      status: request.get('status') as string,
      commentable_id: request.get<number>('commentable_id'),
      commentable_type: request.get<string>('commentable_type'),
    }

    const model = await comments.store(data)

    return response.json(model)
  },
})
