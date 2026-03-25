import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'GetDeploymentLiveTerminalOutput',
  description: 'Gets the live terminal output of the deployment.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    // TODO: replace with model query when available
    return { output: '' }
  },
})
