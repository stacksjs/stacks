import { Action } from '@stacksjs/actions'
import User from '../User'

export default new Action({
      name: 'User Index',
      description: 'User Index ORM Action',

      handle() {
        return User.all()
      },
    })
  