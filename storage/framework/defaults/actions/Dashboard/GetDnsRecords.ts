import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'GetDnsRecords',
  description: 'Gets the DNS records.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    // TODO: replace with model query when Dns model is available
    return { records: [] }
  },
})
