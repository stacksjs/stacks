import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'GetCommandSuccessRate',
  description: 'Gets the command success rate of your application.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    // TODO: replace with model query when Command model is available
    return { successRate: '-' }
  },
})
