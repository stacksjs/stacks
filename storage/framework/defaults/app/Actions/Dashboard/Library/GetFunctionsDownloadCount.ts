import { Action } from '@stacksjs/actions/runtime'

export default new Action({
  name: 'GetFunctionsDownloadCount',
  description: 'Gets the total number of function downloads.',
  apiResponse: true,

  async handle() {
    return {
      available: false,
      downloads: null,
      reason: 'No function download telemetry source is configured.',
    }
  },
})
