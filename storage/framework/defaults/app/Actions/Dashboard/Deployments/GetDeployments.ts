import { Action } from '@stacksjs/actions'
import { Deployment } from '@stacksjs/orm'

export default new Action({
  name: 'GetDeployments',
  description: 'Gets your application deployments.',
  method: 'GET',
  async handle() {
    try {
      const deployments = await Deployment.orderBy('created_at', 'desc').limit(50).get()

      return {
        deployments: deployments.map(d => d.toJSON()),
      }
    }
    catch {
      return { deployments: [] }
    }
  },
})
