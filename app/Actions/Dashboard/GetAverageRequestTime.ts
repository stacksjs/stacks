import { Action } from '@stacksjs/actions'
// import { Library } from '@stacksjs/orm'

export default new Action({
  name: 'GetAverageReleaseTime',
  description: 'Gets the average release time of your library.',
  apiResponse: true,

  async handle() {
    // return Library.averageReleaseTime()
  },
})
