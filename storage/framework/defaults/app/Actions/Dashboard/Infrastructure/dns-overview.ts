type DnsRecordType = 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT'
type DataRecord = Record<string, unknown>

export interface DashboardDnsRecord {
  id: string
  type: DnsRecordType
  name: string
  value: string
  ttl: number | null
  priority: number | null
}

export interface DashboardDnsDomain {
  domain: string
  hostedZoneId: string | null
  status: 'configured'
}

export interface DashboardDnsTypeCount {
  type: DnsRecordType
  count: number
}

export interface DashboardDnsSnapshot {
  domains: DashboardDnsDomain[]
  records: DashboardDnsRecord[]
  nameservers: string[]
  typeCounts: DashboardDnsTypeCount[]
  generatedAt: string
}

function record(value: unknown): DataRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as DataRecord
    : {}
}

function list(value: unknown): DataRecord[] {
  return Array.isArray(value) ? value.map(record) : []
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function number(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function recordValue(type: DnsRecordType, item: DataRecord): string {
  if (type === 'CNAME')
    return text(item.target) ?? text(item.value) ?? ''
  if (type === 'MX')
    return text(item.server) ?? text(item.value) ?? ''
  if (type === 'A' || type === 'AAAA')
    return text(item.address) ?? text(item.value) ?? ''
  return text(item.value) ?? ''
}

function configuredRecords(dnsConfig: DataRecord): DashboardDnsRecord[] {
  const types: DnsRecordType[] = ['A', 'AAAA', 'CNAME', 'MX', 'TXT']
  return types.flatMap((type) => {
    const key = type.toLowerCase()
    return list(dnsConfig[key]).map((item, index) => ({
      id: `${type.toLowerCase()}:${index}`,
      type,
      name: text(item.name) ?? '@',
      value: recordValue(type, item),
      ttl: number(item.ttl),
      priority: type === 'MX' ? number(item.priority) : null,
    }))
  })
}

export function getDashboardDnsSnapshot(
  dnsValue: unknown,
  cloudValue: unknown,
  now: () => Date = () => new Date(),
): DashboardDnsSnapshot {
  const dnsConfig = record(dnsValue)
  const cloudConfig = record(cloudValue)
  const infrastructure = record(cloudConfig.infrastructure)
  const cloudDns = record(infrastructure.dns)
  const domain = text(cloudDns.domain)
  const records = configuredRecords(dnsConfig)
  const recordTypes: DnsRecordType[] = ['A', 'AAAA', 'CNAME', 'MX', 'TXT']

  return {
    domains: domain
      ? [{
          domain,
          hostedZoneId: text(cloudDns.hostedZoneId),
          status: 'configured',
        }]
      : [],
    records,
    nameservers: Array.isArray(dnsConfig.nameservers)
      ? dnsConfig.nameservers.map(text).filter((value): value is string => Boolean(value))
      : [],
    typeCounts: recordTypes.map(type => ({
      type,
      count: records.filter(dnsRecord => dnsRecord.type === type).length,
    })),
    generatedAt: now().toISOString(),
  }
}
