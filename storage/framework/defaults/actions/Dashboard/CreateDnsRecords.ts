import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'CreateDnsRecords',
  description: 'Creates a new DNS record.',
  method: 'POST',
  apiResponse: true,

  async handle() {
    // TODO: replace with model query when Dns model is available
  },
})
