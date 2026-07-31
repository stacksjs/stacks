import { Action } from '@stacksjs/actions'
import { Deployment } from '@stacksjs/orm'

export default new Action({
  name: 'GetRecentDeployments',
  description: 'Gets recent deployments.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    const deployments = await Deployment.orderByDesc('created_at').limit(3).get()
    return deployments.map(deployment => deployment.toJSON())
  },
})
