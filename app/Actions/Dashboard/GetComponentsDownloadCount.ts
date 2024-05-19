import { Action } from '@stacksjs/actions'
// import { Library } from '@stacksjs/orm'

export default new Action({
  name: 'GetComponentsDownloadCount',
  description: 'Gets the total number of component downloads.',
  apiResponse: true,

  async handle() {
    // return Library.componentsDownloadCount()
  },
})
