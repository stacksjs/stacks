import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'ProductUnit Index',
  description: 'ProductUnit Index ORM Action',
  method: 'GET',
  async handle() {
    const results = ProductUnit.all()

    return response.json(results)
  },
})
