import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Log Index',
  description: 'Log Index ORM Action',
  method: 'GET',
  async handle() {
    const results = await Log.all()

    return response.json(results)
  },
})
