import { Action } from '@stacksjs/actions'
import User from '../../orm/src/models/User'
import type { UserRequestType } from '../../types/requests'

export default new Action({
  name: 'User Store',
  description: 'User Store ORM Action',
  method: 'POST',
  async handle(request: UserRequestType) {
    await request.validate()
    const model = await User.create(request.all())

    return model
  },
})
