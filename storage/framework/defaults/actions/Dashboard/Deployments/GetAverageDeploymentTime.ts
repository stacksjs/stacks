import { Action } from '@stacksjs/actions'
import { Deployment } from '@stacksjs/orm'

export default new Action({
  name: 'GetAverageDeploymentTime',
  description: 'Gets the average deployment time of your application.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    const count = await Deployment.count()

    return {
      averageDeploymentTime: '-',
      totalDeployments: count,
    }
  },
})
