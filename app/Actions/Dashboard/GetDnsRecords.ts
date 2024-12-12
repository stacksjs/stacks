import { Action } from '@stacksjs/actions'
// import { Dns } from '@stacksjs/orm'

export default new Action({
  name: 'GetDnsRecords',
  description: 'Gets the DNS records.',
  apiResponse: true,

  async handle() {
    // return Dns.records()
  },
})
