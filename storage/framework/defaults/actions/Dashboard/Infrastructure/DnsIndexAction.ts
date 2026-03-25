import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'DnsIndexAction',
  description: 'Returns DNS record data for the dashboard.',
  method: 'GET',
  async handle() {
    // TODO: replace with model query when DNS model is available
    const domains = [
      { domain: 'stacks.dev', records: 12, status: 'active', ssl: 'valid', expires: '2025-01-15' },
      { domain: 'api.stacks.dev', records: 4, status: 'active', ssl: 'valid', expires: '2025-01-15' },
      { domain: 'docs.stacks.dev', records: 3, status: 'active', ssl: 'valid', expires: '2025-01-15' },
    ]

    const records = [
      { type: 'A', name: '@', value: '192.168.1.100', ttl: '300', proxied: true },
      { type: 'A', name: 'api', value: '192.168.1.101', ttl: '300', proxied: true },
      { type: 'CNAME', name: 'www', value: 'stacks.dev', ttl: '300', proxied: true },
      { type: 'CNAME', name: 'docs', value: 'stacks-docs.pages.dev', ttl: '300', proxied: false },
      { type: 'MX', name: '@', value: 'mx.example.com', ttl: '3600', proxied: false },
      { type: 'TXT', name: '@', value: 'v=spf1 include:_spf.google.com ~all', ttl: '3600', proxied: false },
    ]

    const stats = [
      { label: 'Domains', value: '3' },
      { label: 'DNS Records', value: '19' },
      { label: 'SSL Certificates', value: '3' },
      { label: 'Queries (24h)', value: '45.2K' },
    ]

    return {
      domains,
      records,
      stats,
    }
  },
})
