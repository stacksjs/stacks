import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Category Index',
  description: 'Category Index ORM Action',
  method: 'GET',
  async handle() {
    const results = Category.all()

    return response.json(results)
  },
})
