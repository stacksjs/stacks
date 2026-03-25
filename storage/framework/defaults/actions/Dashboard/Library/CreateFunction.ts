import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'CreateFunction',
  description: 'Creates a new function.',
  method: 'POST',
  apiResponse: true,

  async handle() {
    // TODO: replace with model query when available
  },
})
