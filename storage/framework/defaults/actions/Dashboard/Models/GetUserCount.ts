import { Action } from '@stacksjs/actions'
import { User } from '@stacksjs/orm'

export default new Action({
  name: 'GetUserCount',
  description: 'Gets the total number of users.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    const count = await User.count()
    return { count }
  },
})
