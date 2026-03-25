import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'GetCommands',
  description: 'Gets your application commands.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    // TODO: replace with model query when Command model is available
    return { commands: [] }
  },
})
