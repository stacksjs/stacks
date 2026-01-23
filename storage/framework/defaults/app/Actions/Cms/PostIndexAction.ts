import { Action } from '@stacksjs/actions'
import { posts } from '@stacksjs/cms'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Post Index',
  description: 'Post Index ORM Action',
  method: 'GET',
  async handle() {
    const results = await posts.fetchAll()

    return response.json(results)
  },
})
