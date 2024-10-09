import type { UserRequestType } from '../../types/requests'
import { Action } from '@stacksjs/actions'
import User from '../../orm/src/models/User'

export default new Action({
  name: 'User Show',
  description: 'User Show ORM Action',
  method: 'GET',
  async handle(request: UserRequestType) {
    const id = await request.getParam('id')

    return await User.findOrFail(Number(id))
  },
})
