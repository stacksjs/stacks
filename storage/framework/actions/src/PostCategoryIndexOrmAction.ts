import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'PostCategory Index',
  description: 'PostCategory Index ORM Action',
  method: 'GET',
  async handle() {
    const results = await PostCategory.all()

    return response.json(results)
  },
})
