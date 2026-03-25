import { Action } from '@stacksjs/actions'
// import { Command } from '@stacksjs/orm'

export default new Action({
  name: 'GetCommands',
  description: 'Gets your application commands.',
  apiResponse: true,

  async handle() {
    // return Command.all()
  },
})
