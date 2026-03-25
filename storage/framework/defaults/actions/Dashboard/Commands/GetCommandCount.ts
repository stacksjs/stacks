import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'GetCommandCount',
  description: 'Gets the total number of commands.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    // TODO: replace with model query when Command model is available
    return { count: 0 }
  },
})
