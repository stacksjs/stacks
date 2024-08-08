import { Action } from '@stacksjs/actions'
import User from '../../storage/framework/orm/src/models/User.ts'
import type { UserRequestType } from '../../storage/framework/types/requests'

export default new Action({
  name: 'UserStoreAction',
  description: 'Store User Data',
  method: 'POST',
  requestFile: 'UserRequest',
  async handle(request: UserRequestType) {
    await request.validate()

    const model = await User.create(request.all())

    return model
  },
})
