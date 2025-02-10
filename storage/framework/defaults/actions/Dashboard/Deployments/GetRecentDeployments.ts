import { Action } from '@stacksjs/actions'
// import { Deployment } from '@stacksjs/orm'

export default new Action({
  name: 'GetRecentDeployments',
  description: 'Gets recent deployments.',
  apiResponse: true,

  async handle() {
    // return Deployment.recent(3)
  },
})
