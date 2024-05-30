import { Action } from '@stacksjs/actions'
import User from '../src/models/User'

import { request } from '@stacksjs/router'

export default new Action({
      name: 'User Update',
      description: 'User Update ORM Action',
      method: 'PATCH',
      async handle() {
        const id = request.getParam('id')

        const model = await User.findOrFail(Number(id))

        return model.update(request.all())
      },
    })
  