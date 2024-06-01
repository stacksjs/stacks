import { Action } from '@stacksjs/actions'
// import { Deployment } from '@stacksjs/orm'

export default new Action({
  name: 'GetDeploymentCount',
  description: 'Gets the total number of deployments.',
  apiResponse: true,

  async handle() {
    // return Deployment.count()
  },
})
