import { Action } from '@stacksjs/actions'
import { comments } from '@stacksjs/cms'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Comment Index',
  description: 'Comment Index ORM Action',
  method: 'GET',
  async handle() {
    const results = await comments.fetchCommentsBycommentables(1, 'post')

    return response.json(results)
  },
})
