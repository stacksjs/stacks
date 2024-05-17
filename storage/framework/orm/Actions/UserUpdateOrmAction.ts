import { Action } from '@stacksjs/actions'
import User from '../src/User'

export default new Action({
      name: 'User Update',
      description: 'User Update ORM Action',

      handle() {
        const model = User.create({})

        return model
      },
    })
  