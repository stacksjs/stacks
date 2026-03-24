import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'DnsIndexAction',
  description: 'Returns DNS record data for the dashboard.',
  method: 'GET',
  async handle() {
    return {
      records: [
        { id: 1, type: 'A', name: '@', value: '76.76.21.21', ttl: 3600, status: 'active' },
        { id: 2, type: 'CNAME', name: 'www', value: 'cname.example.com', ttl: 3600, status: 'active' },
        { id: 3, type: 'MX', name: '@', value: 'mail.example.com', ttl: 3600, priority: 10, status: 'active' },
        { id: 4, type: 'TXT', name: '@', value: 'v=spf1 include:_spf.google.com ~all', ttl: 3600, status: 'active' },
      ],
      domain: 'stacksjs.com',
    }
  },
})
