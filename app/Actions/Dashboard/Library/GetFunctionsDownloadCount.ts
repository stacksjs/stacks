import { Action } from '@stacksjs/actions'
// import { Library } from '@stacksjs/orm'

export default new Action({
  name: 'GetFunctionsDownloadCount',
  description: 'Gets the total number of function downloads.',
  apiResponse: true,

  async handle() {
    // return Library.functionsDownloadCount()
  },
})
