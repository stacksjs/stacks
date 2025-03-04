import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'ProductCategory Index',
  description: 'ProductCategory Index ORM Action',
  method: 'GET',
  async handle() {
    const results = ProductCategory.all()

    return response.json(results)
  },
})
