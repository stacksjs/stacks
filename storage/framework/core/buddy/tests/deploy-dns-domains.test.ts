import { describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { configDnsDomains, dnsProviderNameFromNameservers, hasExplicitEmailConfig, mailServerOwnerFromConfig } from '../src/commands/deploy'

describe('configDnsDomains', () => {
  it('keeps application zones and normalizes www aliases', () => {
    expect(configDnsDomains({
      main: { domain: 'example.com', root: 'dist' },
      api: { domain: 'example.com', path: '/api', port: 3000 },
      www: { domain: 'www.example.com', root: 'dist' },
    })).toEqual(['example.com'])
  })

  it('does not treat a host inside a zone the app already owns as its own zone', () => {
    // config/dns.ts describes ONE zone. Reconciling it against every site
    // hostname made the deploy try to create `www.mta-sts.example.com` from
    // the scaffold's `{ name: 'www' }` entry: a record in a zone that does not
    // exist, for a host nobody asked for, failing once per deploy.
    expect(configDnsDomains({
      main: { domain: 'example.com', root: 'dist' },
      mtaSts: { domain: 'mta-sts.example.com', start: 'bun serve' },
      dashboard: { domain: 'dashboard.example.com', port: 3001 },
    })).toEqual(['example.com'])
  })

  it('keeps a subdomain that is the only zone the app has', () => {
    // Nothing above it to inherit from, so its records are its own.
    expect(configDnsDomains({
      docs: { domain: 'docs.example.com', root: 'dist' },
    })).toEqual(['docs.example.com'])
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

describe('mailServerOwnerFromConfig', () => {
  it('normalizes an explicit shared mail server owner', () => {
    expect(mailServerOwnerFromConfig({ server: { enabled: true, attachTo: ' stacks ' } })).toBe('stacks')
  })

  it('keeps same-box mail as the default', () => {
    expect(mailServerOwnerFromConfig({ server: { enabled: true } })).toBeUndefined()
    expect(mailServerOwnerFromConfig({ server: { enabled: true, attachTo: '  ' } })).toBeUndefined()
  })
})
