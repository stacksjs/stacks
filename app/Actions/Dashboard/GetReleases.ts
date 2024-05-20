import { Action } from '@stacksjs/actions'
// import { Release } from '@stacksjs/orm'

export default new Action({
  name: 'GetReleases',
  description: 'Gets your releases.',
  apiResponse: true,

  async handle() {
    // return Release.all()
  },
})
