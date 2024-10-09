import type { UserRequestType } from '../../types/requests'
import { Action } from '@stacksjs/actions'
import User from '../../orm/src/models/User'

export default new Action({
  name: 'User Index',
  description: 'User Index ORM Action',
  method: 'GET',
  async handle(request: UserRequestType) {
    return await User.all()
  },
})
