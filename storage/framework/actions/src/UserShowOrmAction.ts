import { Action } from '@stacksjs/actions'
 import { response } from '@stacksjs/router'

  import type { UserRequestType } from '@stacksjs/orm'
 import { User } from '@stacksjs/orm'
 import { response } from '@stacksjs/router'

export default new Action({
      name: 'User Show',
      description: 'User Show ORM Action',
      method: 'GET',
      async handle(request: UserRequestType) {
        const id = request.getParam('id')

        const model = await User.findOrFail(id)

        return response.json(model)
      },
    })
  