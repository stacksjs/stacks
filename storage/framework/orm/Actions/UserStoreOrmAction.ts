import { Action } from '@stacksjs/actions'
import User from '../User'

export default new Action({
      name: 'User Store',
      description: 'User Store ORM Action',

      handle() {
        const model = User.create({})

        return model
      },
    })
  