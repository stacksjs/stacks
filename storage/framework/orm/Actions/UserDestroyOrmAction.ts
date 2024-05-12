import { Action } from '@stacksjs/actions'
import User from '../User'

export default new Action({
      name: 'User Destroy',
      description: 'User Destroy ORM Action',

      handle() {
        const model = User.find(1)

        model.delete()

        return 'Model deleted!'
      },
    })
  