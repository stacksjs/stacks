import { Action } from '@stacksjs/actions/runtime'
import { response } from '@stacksjs/router'
import { resolveDashboardModel } from '../../../../resources/functions/dashboard/model-access'
import { dashboardOperationalError } from '../dashboard-response'

export default new Action({
  name: 'GetUserCount',
  description: 'Gets the total number of users.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    try {
      const Model = await resolveDashboardModel('User')
      if (!Model) return response.json({ message: 'Model not found.' }, 404)
      return await Model.count()
    }
    catch (error) {
      return dashboardOperationalError(error, 'User total could not be loaded.', 'GetUserCount')
    }
  },
})
