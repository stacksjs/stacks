import { Action } from '@stacksjs/actions'
// import { Command } from '@stacksjs/orm'

export default new Action({
  name: 'GetCommandSuccessRate',
  description: 'Gets the command success rate of your application.',
  apiResponse: true,

  async handle() {
    // return Command.successRate()
  },
})
