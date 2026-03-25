import { Action } from '@stacksjs/actions'
import { Deployment } from '@stacksjs/orm'

export default new Action({
  name: 'GetRecentDeployments',
  description: 'Gets recent deployments.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    const items = await Deployment.orderBy('created_at', 'desc').limit(3).get()

    return {
      deployments: items.map(i => i.toJSON()),
    }
  },
})
