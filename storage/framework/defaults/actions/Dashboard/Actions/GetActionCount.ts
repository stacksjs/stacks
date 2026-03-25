import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'GetActionCount',
  description: 'Gets the total number of actions.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    // TODO: replace with model query when Action model is available
    return { count: 0 }
  },
})
