import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

// The original implementation called `Deployment.averageDuration()`,
// which doesn't exist on the model yet. Returning a placeholder so
// the route registers cleanly until the aggregation is wired.
export default new Action({
  name: 'GetAverageDeploymentTime',
  description: 'Gets the average deployment time of your application.',
  apiResponse: true,

  async handle() {
    return response.json({ average_seconds: null, note: 'Not yet implemented' })
  },
})
