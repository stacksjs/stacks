import { Action } from '@stacksjs/actions'
import { Deployment } from '@stacksjs/orm'

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
    catch {
      return { deployments: [] }
    }
  },
})
