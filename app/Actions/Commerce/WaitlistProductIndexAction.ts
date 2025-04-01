import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'WaitlistProduct Index',
  description: 'WaitlistProduct Index ORM Action',
  method: 'GET',
  async handle() {
    const results = WaitlistProduct.all()

    return response.json(results)
  },
})
