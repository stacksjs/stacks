import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'GetFunctionsDownloadCount',
  description: 'Gets the total number of function downloads.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    // TODO: replace with model query when available
    return { count: 0 }
  },
})
