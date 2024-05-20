import { Action } from '@stacksjs/actions'
// import { Command } from '@stacksjs/orm'

export default new Action({
  name: 'GetAverageCommandTime',
  description: 'Gets the average command time of your application.',
  apiResponse: true,

  async handle() {
    // return Command.averageDuration()
  },
})
