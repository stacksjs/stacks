import type { DnsConfig } from '@stacksjs/types'
import { isIP } from 'node:net'
import { applicationDnsHosts, configDnsDomains, desiredDnsRecords, dnsRecordSkipReason, planDnsSync } from '@stacksjs/dns'

const recordKeys = { A: 'a', AAAA: 'aaaa', CNAME: 'cname', TXT: 'txt', MX: 'mx' } as const

interface DnsSettingsInput {
  type?: unknown
  domain?: unknown
  host?: unknown
  value?: unknown
  ttl?: unknown
  priority?: unknown
}

export interface DashboardDnsConfiguration {
  domains: string[]
  hosts: string[]
  config: DnsConfig
}

export function dashboardDnsConfiguration(config: DnsConfig, cloud: {
  infrastructure?: { dns?: { domain?: string } }
  sites?: Record<string, unknown>
}, fallbackDomain?: string): DashboardDnsConfiguration {
  const sites = cloud.sites ?? {}
  const domains = configDnsDomains(sites, cloud.infrastructure?.dns?.domain || fallbackDomain)
  return { domains, hosts: [...new Set([...applicationDnsHosts(sites), ...domains])], config }
}

export function configuredDashboardDnsRecords(config: DnsConfig) {
  return [
    ...(config.a ?? []).map(({ name, address, ttl }) => ({ type: 'A', name, value: address, ttl })),
    ...(config.aaaa ?? []).map(({ name, address, ttl }) => ({ type: 'AAAA', name, value: address, ttl })),
    ...(config.cname ?? []).map(({ name, target, ttl }) => ({ type: 'CNAME', name, value: target, ttl })),
    ...(config.txt ?? []).map(({ name, content, ttl }) => ({ type: 'TXT', name, value: content, ttl })),
    ...(config.mx ?? []).map(({ name, mailServer, ttl, priority }) => ({ type: 'MX', name, value: mailServer, ttl, priority })),
  ]
}

function validLabels(value: string, service = false): boolean {
  const label = service ? /^[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?$/i : /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i
  return value.length <= 253 && value.split('.').every(part => label.test(part))
}

export function dashboardDnsRecord(input: DnsSettingsInput, settings: DashboardDnsConfiguration) {
  const type = typeof input.type === 'string' && Object.hasOwn(recordKeys, input.type) ? input.type as keyof typeof recordKeys : undefined
  if (!type)
    throw new Error('Choose a supported DNS record type.')
  if (typeof input.domain !== 'string' || !settings.domains.includes(input.domain))
    throw new Error('Choose a domain configured for this project.')
  if (typeof input.host !== 'string')
    throw new TypeError('Enter a host name or use @ for the selected domain.')
  if (typeof input.value !== 'string' || !input.value.trim() || /[\0\r\n]/.test(input.value))
    throw new Error('Enter a valid record value.')
  if (typeof input.ttl !== 'number' || !Number.isInteger(input.ttl) || input.ttl < 600 || input.ttl > 2_147_483_647)
    throw new Error('TTL must be a whole number of seconds between 600 and 2147483647.')

  const scope = input.domain
  const host = input.host.trim().toLowerCase()
  const unqualified = host.replace(/\.$/, '')
  const inScope = unqualified === scope || unqualified.endsWith(`.${scope}`)
  if (host.endsWith('.') && !inScope)
    throw new Error(`Use a name inside ${scope}.`)

  const fqdn = !host || host === '@' ? scope : inScope ? unqualified : `${host}.${scope}`
  if (!validLabels(fqdn.replace(/^\*\./, ''), true))
    throw new Error('Enter a valid host name, such as verify or _acme-challenge.')
  if (['A', 'AAAA', 'CNAME'].includes(type) && (settings.hosts.includes(fqdn) || fqdn === `www.${scope}`))
    throw new Error('Deployment manages routing for this hostname. Choose a different host.')

  const value = type === 'TXT' ? input.value : input.value.trim()
  const ttl = input.ttl
  const name = `${fqdn}.`
  const key = recordKeys[type]
  let record: Record<string, string | number>

  if (type === 'A' || type === 'AAAA') {
    if (isIP(value) !== (type === 'A' ? 4 : 6))
      throw new Error(type === 'A' ? 'Enter an IPv4 address.' : 'Enter an IPv6 address.')
    record = { name, address: value, ttl }
  }
  else if (type === 'TXT') {
    record = { name, content: value, ttl }
  }
  else {
    const destination = value === '@' ? scope : value.replace(/\.$/, '').toLowerCase()
    if (!destination.includes('.') || !validLabels(destination))
      throw new Error('Enter a fully qualified destination, such as mail.example.com.')
    if (type === 'CNAME') {
      if (destination === fqdn)
        throw new Error('A CNAME cannot point to itself.')
      record = { name, target: destination, ttl }
    }
    else {
      const priority = input.priority
      if (typeof priority !== 'number' || !Number.isInteger(priority) || priority < 0 || priority > 65535)
        throw new Error('MX priority must be a whole number between 0 and 65535.')
      record = { name, mailServer: destination, ttl, priority }
    }
  }

  const desired = desiredDnsRecords(scope, { [key]: [record] })[0]!
  const reason = dnsRecordSkipReason(desired, scope)
  if (reason)
    throw new Error(reason)
  const existing = desiredDnsRecords(scope, settings.config)
  const plan = planDnsSync([desired], existing, { zone: scope })
  if (plan.keep.length)
    throw new Error('This record is already declared in config/dns.ts.')
  if (plan.skip.length)
    throw new Error('A conflicting record is already declared at this name.')
  return { key, record }
}
