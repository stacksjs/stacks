import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Product Index',
  description: 'Product Index ORM Action',
  method: 'GET',
  async handle() {
    const results = Product.all()

    return response.json(results)
  },
})
