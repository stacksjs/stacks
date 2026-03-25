import { Action } from '@stacksjs/actions'
// import { Deployment } from '@stacksjs/orm'

export default new Action({
  name: 'GetDeploymentLiveTerminalOutput',
  description: 'Gets the live terminal output of the deployment.',
  apiResponse: true,

  async handle() {
    // return Deployment.liveTerminalOutput()
  },
})
