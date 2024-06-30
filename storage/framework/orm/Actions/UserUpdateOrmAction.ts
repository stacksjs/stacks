import { Action } from '@stacksjs/actions'
import type { UserRequestType } from '../../types/requests'
import User from '../src/models/User'

export default new Action({
  name: 'User Update',
  description: 'User Update ORM Action',
  method: 'PATCH',
  async handle(request: UserRequestType) {
    await request.validate()

    const id = request.getParam('id')

    const model = await User.findOrFail(Number(id))

    return model.update(request.all())
  },
})
