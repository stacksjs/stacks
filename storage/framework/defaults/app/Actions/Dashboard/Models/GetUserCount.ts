import { Action } from '@stacksjs/actions'
import { User } from '@stacksjs/orm'
import { dashboardOperationalError } from '../dashboard-response'

export default new Action({
  name: 'GetUserCount',
  description: 'Gets the total number of users.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    try {
      return await User.count()
    }
    catch (error) {
      return dashboardOperationalError(error, 'User total could not be loaded.', 'GetUserCount')
    }
  },
})
