import { Action } from '@stacksjs/actions'
import { Deployment } from '@stacksjs/orm'
import { dashboardOperationalError } from '../dashboard-response'

export default new Action({
  name: 'GetDeploymentCount',
  description: 'Gets the total number of deployments.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    try {
      return await Deployment.count()
    }
    catch (error) {
      return dashboardOperationalError(error, 'Deployment count could not be loaded.', 'GetDeploymentCount')
    }
  },
})
