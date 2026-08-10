import { Action } from '@stacksjs/actions'
import { Deployment } from '@stacksjs/orm'
import { dashboardOperationalError } from '../dashboard-response'

export default new Action({
  name: 'GetDeployments',
  description: 'Returns recent Deployment model records for the dashboard.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    try {
      const deployments = await Deployment.orderBy('created_at', 'desc').limit(100).get()

      return {
        deployments: deployments.map(d => d.toJSON()),
      }
    }
    catch (error) {
      return dashboardOperationalError(error, 'Deployment records could not be loaded.', 'GetDeployments')
    }
  },
})
