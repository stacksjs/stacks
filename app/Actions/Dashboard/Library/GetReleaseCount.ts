import { Action } from '@stacksjs/actions'
// import { Library } from '@stacksjs/orm'

export default new Action({
  name: 'GetReleaseCount',
  description: 'Gets the total number of releases of your library.',
  apiResponse: true,

  async handle() {
    // return Library.releaseCount()
  },
})
