import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Post Index',
  description: 'Post Index ORM Action',
  method: 'GET',
  async handle() {
    const results = await Post.all()

    return response.json(results)
  },
})
