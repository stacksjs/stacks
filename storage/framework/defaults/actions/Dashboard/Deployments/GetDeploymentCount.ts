import { Action } from '@stacksjs/actions'
import { Deployment } from '@stacksjs/orm'

export default new Action({
  name: 'GetDeploymentCount',
  description: 'Gets the total number of deployments.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    const count = await Deployment.count()
    return { count }
  },
})
