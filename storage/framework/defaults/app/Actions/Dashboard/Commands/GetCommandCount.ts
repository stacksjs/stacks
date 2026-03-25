import { Action } from '@stacksjs/actions'
// import { Command } from '@stacksjs/orm'

export default new Action({
  name: 'GetCommandCount',
  description: 'Gets the total number of commands.',
  apiResponse: true,

  async handle() {
    // return Command.count()
  },
})
