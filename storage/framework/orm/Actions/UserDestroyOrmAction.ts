import { Action } from '@stacksjs/actions'
import User from '../src/models/User'

import { request } from '@stacksjs/router'

export default new Action({
      name: 'User Destroy',
      description: 'User Destroy ORM Action',

      handle() {
        const id = request.getParam('id')

        const model = User.find(id)

        model.delete()

        return 'Model deleted!'
      },
    })
  