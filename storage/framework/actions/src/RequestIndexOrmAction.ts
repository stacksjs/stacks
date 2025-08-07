import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Request Index',
  description: 'Request Index ORM Action',
  method: 'GET',
  async handle() {
    const results = await Request.all()

    return response.json(results)
  },
})
