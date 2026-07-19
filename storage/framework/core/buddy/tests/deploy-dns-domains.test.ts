import { describe, expect, it } from 'bun:test'
import { configDnsDomains, dnsProviderNameFromNameservers } from '../src/commands/deploy'

describe('configDnsDomains', () => {
  it('keeps application zones and normalizes www aliases', () => {
    expect(configDnsDomains({
      main: { domain: 'example.com', root: 'dist' },
      api: { domain: 'example.com', path: '/api', port: 3000 },
      www: { domain: 'www.example.com', root: 'dist' },
    })).toEqual(['example.com'])
  })

  it('does not copy primary-zone records to redirect-only domains', () => {
    expect(configDnsDomains({
      main: { domain: 'example.com', root: 'dist' },
      legacy: { domain: 'example-old.com', redirect: 'https://example.com' },
      legacyWww: { domain: 'www.example-old.com', redirect: 'https://example.com' },
    })).toEqual(['example.com'])
  })
})

describe('dnsProviderNameFromNameservers', () => {
  it('recognizes Porkbun authoritative nameservers', () => {
    expect(dnsProviderNameFromNameservers([
      'maceio.ns.porkbun.com.',
      'salvador.ns.porkbun.com.',
    ])).toBe('porkbun')
  })

  it('recognizes other supported DNS providers', () => {
    expect(dnsProviderNameFromNameservers(['ada.ns.cloudflare.com.'])).toBe('cloudflare')
    expect(dnsProviderNameFromNameservers(['ns-123.awsdns-45.org.'])).toBe('route53')
    expect(dnsProviderNameFromNameservers(['ns01.domaincontrol.com.'])).toBe('godaddy')
  })

  it('does not guess for an unknown nameserver network', () => {
    expect(dnsProviderNameFromNameservers(['ns1.example.net.'])).toBeNull()
  })
})
