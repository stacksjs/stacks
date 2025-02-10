import { Action } from '@stacksjs/actions'
// import { Deployment } from '@stacksjs/orm'

export default new Action({
  name: 'GetDeployScript',
  description: 'Gets the deploy script used by the application.',
  apiResponse: true,

  async handle() {
    // return Deployment.script()
  },
})
