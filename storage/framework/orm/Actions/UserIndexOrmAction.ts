import { Action } from '@stacksjs/actions'
import User from '../src/User'

import { request } from '@stacksjs/router'

export default new Action({
  name: 'User Index',
  description: 'User Index ORM Action',

  handle() {
    return User.all()
  },
})
