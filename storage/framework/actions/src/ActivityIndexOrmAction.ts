import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Activity Index',
  description: 'Activity Index ORM Action',
  method: 'GET',
  async handle() {
    const results = Activity.all()

    return response.json(results)
  },
})
