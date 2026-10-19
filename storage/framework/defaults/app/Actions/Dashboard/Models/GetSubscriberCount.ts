import { Action } from '@stacksjs/actions/runtime'
import { response } from '@stacksjs/router'
import { resolveDashboardModel } from '../../../../resources/functions/dashboard/model-access'
import { dashboardOperationalError } from '../dashboard-response'

export default new Action({
  name: 'GetSubscriberCount',
  description: 'Gets the total number of subscribers.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    try {
      const Model = await resolveDashboardModel('Subscriber')
      if (!Model) return response.json({ message: 'Model not found.' }, 404)
      return await Model.count()
    }
    catch (error) {
      return dashboardOperationalError(error, 'Subscriber total could not be loaded.', 'GetSubscriberCount')
    }
  },
})
