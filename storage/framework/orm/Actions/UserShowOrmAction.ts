import { Action } from '@stacksjs/actions'
import User from '../src/models/User'

export default new Action({
      name: 'User Show',
      description: 'User Show ORM Action',
      method: 'GET',
      async handle(request: any) {
        const id = await request.getParam('id')

        return User.findOrFail(Number(id))
      },
    })
  