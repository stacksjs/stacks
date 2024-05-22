import { Action } from '@stacksjs/actions'
import User from '../src/models/User'

import { request } from '@stacksjs/router'

export default new Action({
      name: 'User Update',
      description: 'User Update ORM Action',

      handle() {
        const id = request.get(req.params.id)

        const model = User.find(req.params.id)

        return model.update(req.all())
      },
    })
  