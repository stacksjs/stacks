import type { UserRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { User } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'User Store',
  description: 'User Store ORM Action',
  method: 'POST',
  async handle(request: UserRequestType) {
    await request.validate()
    const model = await User.create(request.all())

    return response.json(model)
  },
})
