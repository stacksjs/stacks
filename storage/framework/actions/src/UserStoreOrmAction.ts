import type { UserRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

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
