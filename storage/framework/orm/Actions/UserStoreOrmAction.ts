import { Action } from '@stacksjs/actions'
import User from '../src/User'

import { request } from '@stacksjs/router'

export default new Action({
  name: 'User Store',
  description: 'User Store ORM Action',

  handle() {
    const model = User.create(request.all())

    return model
  },
})
