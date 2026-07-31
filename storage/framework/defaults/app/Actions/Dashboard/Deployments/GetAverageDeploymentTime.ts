import { Action } from '@stacksjs/actions'
import { Deployment } from '@stacksjs/orm'
import { averageRecordedDuration } from './deployment-input'

export default new Action({
  name: 'GetAverageDeploymentTime',
  description: 'Gets the average deployment time of your application.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    const deployments = await Deployment.all()
    return { average_seconds: averageRecordedDuration(deployments) }
  },
})
