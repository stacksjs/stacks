import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'UpdateDeployScript',
  description: 'Updates the deploy script.',
  method: 'POST',
  apiResponse: true,

  async handle() {
    // TODO: replace with model query when available
  },
})
