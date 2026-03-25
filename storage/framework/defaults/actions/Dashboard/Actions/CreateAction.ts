import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'CreateAction',
  description: 'Creates a new action.',
  method: 'POST',
  apiResponse: true,

  async handle() {
    // TODO: replace with model query when available
  },
})
