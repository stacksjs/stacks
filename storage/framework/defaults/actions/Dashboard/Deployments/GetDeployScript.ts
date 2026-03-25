import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'GetDeployScript',
  description: 'Gets the deploy script used by the application.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    // TODO: replace with model query when available
    return { script: '' }
  },
})
