import type { UserRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'User Show',
  description: 'User Show ORM Action',
  method: 'GET',
  async handle(request: UserRequestType) {
    const id = request.getParam('id')

    return await User.findOrFail(Number(id))
  },
})
