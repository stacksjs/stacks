import { describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { configDnsDomains, dnsProviderNameFromNameservers, hasExplicitEmailConfig } from '../src/commands/deploy'

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

describe('hasExplicitEmailConfig', () => {
  it('does not treat framework email defaults as application mail intent', () => {
    const root = mkdtempSync(join(tmpdir(), 'stacks-email-config-'))

    try {
      expect(hasExplicitEmailConfig(root)).toBe(false)
      mkdirSync(join(root, 'config'))
      writeFileSync(join(root, 'config', 'email.ts'), 'export default {}\n')
      expect(existsSync(join(root, 'config', 'email.ts'))).toBe(true)
      expect(hasExplicitEmailConfig(root)).toBe(true)
    }
    finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
