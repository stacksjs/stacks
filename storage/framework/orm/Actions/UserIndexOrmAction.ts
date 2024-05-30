import { Action } from '@stacksjs/actions'
import User from '../src/models/User'

import { request } from '@stacksjs/router'

export default new Action({
      name: 'User Index',
      description: 'User Index ORM Action',
      method: 'GET',
      async handle() {
        return await User.all()
      },
    })
  