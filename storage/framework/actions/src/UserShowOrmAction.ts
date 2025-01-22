import type { UserRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'User Show',
  description: 'User Show ORM Action',
  method: 'GET',
  async handle(request: UserRequestType) {
    const id = await request.getParam('id')

    const user = await User.with(['transactions', 'test', 'deployments']).findOrFail(id)

    return response.json(user)
  },
})
