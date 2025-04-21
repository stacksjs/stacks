import type { commentablesRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { comments } from '@stacksjs/cms'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Comment Destroy',
  description: 'Comment Destroy ORM Action',
  method: 'DELETE',
  async handle(request: commentablesRequestType) {
    const id = request.getParam('id')

    await comments.destroy(id)

    return response.json({ message: 'Model deleted!' })
  },
})
