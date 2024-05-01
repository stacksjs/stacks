import { User } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'GetTotalUsers',
  description: 'Gets the total number of users.',
  apiResponse: true,

  async handle() {
    return User.count()
  },
})
