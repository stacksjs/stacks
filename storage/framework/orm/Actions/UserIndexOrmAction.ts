import { Action } from '@stacksjs/actions'
import User from '../src/models/User'

export default new Action({
      name: 'User Index',
      description: 'User Index ORM Action',
      method: 'GET',
      async handle(request: any) {
        return await User.all()
      },
    })
  