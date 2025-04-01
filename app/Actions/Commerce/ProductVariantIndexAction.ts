import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'ProductVariant Index',
  description: 'ProductVariant Index ORM Action',
  method: 'GET',
  async handle() {
    const results = ProductVariant.all()

    return response.json(results)
  },
})
