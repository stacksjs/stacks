import { Action } from '@stacksjs/actions'
import User from '../src/models/User'

import { request } from '@stacksjs/router'

export default new Action({
      name: 'User Show',
      description: 'User Show ORM Action',
      method: 'GET',
      handle() {
        const id = request.getParam('id')

        return User.find(id)
      },
    })
  