import { Action } from '@stacksjs/actions'
import User from '../src/User'

export default new Action({
      name: 'User Show',
      description: 'User Show ORM Action',

      handle() {
        return User.find(1)
      },
    })
  