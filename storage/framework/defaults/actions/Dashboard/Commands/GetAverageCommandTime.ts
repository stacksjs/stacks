import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'GetAverageCommandTime',
  description: 'Gets the average command time of your application.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    // TODO: replace with model query when Command model is available
    return { averageCommandTime: '-' }
  },
})
