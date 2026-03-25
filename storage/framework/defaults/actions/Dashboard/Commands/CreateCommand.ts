import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'CreateCommand',
  description: 'Creates a new command.',
  method: 'POST',
  apiResponse: true,

  async handle() {
    // TODO: replace with model query when available
  },
})
