import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Driver Index',
  description: 'Driver Index ORM Action',
  method: 'GET',
  async handle() {
    const results = Driver.all()

    return response.json(results)
  },
})
