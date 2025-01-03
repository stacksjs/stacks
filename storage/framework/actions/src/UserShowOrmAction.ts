import type { UserRequestType } from '../../types/requests'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import User from '../../orm/src/models/User'

export default new Action({
  name: 'User Show',
  description: 'User Show ORM Action',
  method: 'GET',
  async handle(request: UserRequestType) {
    const id = await request.getParam('id')

    const user = await User.with(['transactions', 'test', 'deployments']).find(Number(id))

    return response.json(user, 201)
  },
})
