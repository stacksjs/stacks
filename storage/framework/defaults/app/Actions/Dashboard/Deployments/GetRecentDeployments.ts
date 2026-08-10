import { Action } from '@stacksjs/actions'
import { Deployment } from '@stacksjs/orm'
import { dashboardOperationalError } from '../dashboard-response'

export default new Action({
  name: 'GetRecentDeployments',
  description: 'Gets recent deployments.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    try {
      const deployments = await Deployment.orderByDesc('created_at').limit(3).get()
      return deployments.map(deployment => deployment.toJSON())
    }
    catch (error) {
      return dashboardOperationalError(error, 'Recent deployments could not be loaded.', 'GetRecentDeployments')
    }
  },
})
