import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Comment Index',
  description: 'Comment Index ORM Action',
  method: 'GET',
  async handle() {
    const results = await Comment.all()

    return response.json(results)
  },
})
