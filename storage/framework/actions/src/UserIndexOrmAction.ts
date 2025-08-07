import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'User Index',
  description: 'User Index ORM Action',
  method: 'GET',
  async handle() {
    const results = await User.all()

    return response.json(results)
  },
})
