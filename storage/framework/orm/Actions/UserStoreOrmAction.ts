import { Action } from '@stacksjs/actions'
import User from '../src/models/User'

import { request } from '@stacksjs/router'

export default new Action({
  name: 'User Store',
  description: 'User Store ORM Action',
  method: 'POST',
  async handle() {
    const model = await User.create(request.all())

    return model
  },
})
