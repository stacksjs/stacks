import { Action } from '@stacksjs/actions'
import type { UserRequestType } from '../../types/requests'
import User from '../src/models/User'

export default new Action({
  name: 'User Index',
  description: 'User Index ORM Action',
  method: 'GET',
  async handle(request: UserRequestType) {
    return await User.get()
  },
})
