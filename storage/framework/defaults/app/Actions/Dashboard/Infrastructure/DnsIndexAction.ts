import { Action } from '@stacksjs/actions'
import { config } from '@stacksjs/config'

export default new Action({
  name: 'DnsIndexAction',
  description: 'Returns DNS configuration from config files.',
  method: 'GET',
  async handle() {
    try {
      const dnsConfig = config.dns || {}

      // Read A records from config/dns.ts
      const aRecords = (dnsConfig as any).a || []
      const aaaaRecords = (dnsConfig as any).aaaa || []
      const cnameRecords = (dnsConfig as any).cname || []
      const mxRecords = (dnsConfig as any).mx || []
      const txtRecords = (dnsConfig as any).txt || []
      const nameservers = (dnsConfig as any).nameservers || []

      // Build unified records list
      const records: Array<Record<string, unknown>> = []

      for (const rec of aRecords) {
        records.push({
          type: 'A',
          name: rec.name || '@',
          value: rec.address || rec.value || '',
          ttl: String(rec.ttl || 300),
        })
      }

      for (const rec of aaaaRecords) {
        records.push({
          type: 'AAAA',
          name: rec.name || '@',
          value: rec.address || rec.value || '',
          ttl: String(rec.ttl || 300),
        })
      }

      for (const rec of cnameRecords) {
        records.push({
          type: 'CNAME',
          name: rec.name || '',
          value: rec.target || rec.value || '',
          ttl: String(rec.ttl || 300),
        })
      }

      for (const rec of mxRecords) {
        records.push({
          type: 'MX',
          name: rec.name || '@',
          value: rec.server || rec.value || '',
          ttl: String(rec.ttl || 3600),
          priority: rec.priority,
        })
      }

      for (const rec of txtRecords) {
        records.push({
          type: 'TXT',
          name: rec.name || '@',
          value: rec.value || '',
          ttl: String(rec.ttl || 3600),
        })
      }

      // Build domain info from the cloud config DNS settings
      const cloudDns = (config.cloud as any)?.infrastructure?.dns ?? {}
      const primaryDomain = cloudDns.domain || ''

      const domains = []
      if (primaryDomain) {
        domains.push({
          domain: primaryDomain,
          records: records.length,
          status: 'active',
          hostedZoneId: cloudDns.hostedZoneId || '',
        })
      }

      const stats = [
        { label: 'Domains', value: String(domains.length || 1) },
        { label: 'DNS Records', value: String(records.length) },
        { label: 'Nameservers', value: String(nameservers.length) },
        { label: 'A Records', value: String(aRecords.length) },
      ]

      return {
        domains,
        records,
        nameservers,
        stats,
      }
    }
    catch {
      return { domains: [], records: [], nameservers: [], stats: [] }
    }
  },
})
