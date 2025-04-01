import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'ProductItem Index',
  description: 'ProductItem Index ORM Action',
  method: 'GET',
  async handle() {
    const results = ProductItem.all()

    return response.json(results)
  },
})
