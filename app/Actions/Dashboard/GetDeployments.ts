import { Action } from '@stacksjs/actions'
// import { Deployment } from '@stacksjs/orm'

export default new Action({
  name: 'GetDeployments',
  description: 'Gets your application deployments.',
  apiResponse: true,

  async handle() {
    // return Deployment.all()
  },
})
