import { Action } from '@stacksjs/actions'
import User from '../src/models/User'
 import type { UserRequestType } from '../../requests/UserRequest'

export default new Action({
      name: 'User Index',
      description: 'User Index ORM Action',
      method: 'GET',
      async handle(request: UserRequestType) {
        return await User.all()
      },
    })
  