import type { UserRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { User } from '@stacksjs/orm'

export default new Action({
  name: 'UserStoreAction',
  description: 'Store User Data',
  method: 'POST',
  model: 'User',
  async handle(request: UserRequestType) {
    await request.validate()

    const model = await User.create(request.all())

    return model
  },
})
