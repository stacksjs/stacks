import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'GetComponentsDownloadCount',
  description: 'Gets the total number of component downloads.',
  apiResponse: true,

  async handle() {
    return {
      available: false,
      downloads: null,
      reason: 'No component download telemetry source is configured.',
    }
  },
})
