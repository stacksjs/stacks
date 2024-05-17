import { Action } from '@stacksjs/actions'
// import { Library } from '@stacksjs/orm'

export default new Action({
  name: 'GetDownloadCount',
  description: 'Gets the total number of downloads.',
  apiResponse: true,

  async handle() {
    // return Library.downloadCount()
  },
})
