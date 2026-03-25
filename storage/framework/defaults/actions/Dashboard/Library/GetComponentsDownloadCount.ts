import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'GetComponentsDownloadCount',
  description: 'Gets the total number of component downloads.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    // TODO: replace with model query when available
    return { count: 0 }
  },
})
