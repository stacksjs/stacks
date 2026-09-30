/**
 * `buddy doctor`'s mail DNS checks, and the credential fix `buddy deploy`
 * prints when it cannot publish mail DNS.
 *
 * The case behind them: stacksjs.com's zone is on Cloudflare, the project had
 * no CLOUDFLARE_API_TOKEN, and every deploy quietly printed the mail records
 * "by hand" instead of publishing them, for months. So the verdicts that
 * matter are pinned here - a zone no configured provider can write is a
 * warning that names the exact `buddy env:set` command, and a value is never
 * part of any message.
 */
import { describe, expect, it } from 'bun:test'
import { dnsCredentialFix, dnsCredentialPresence, envFileForEnvironment, envFileKeys } from '../src/dns-credentials'
import { describeMailDnsProvider, describeMailDnsRecords, describePostmaster, joinTxtAnswers, mailDomainFromConfig } from '../src/mail-dns-health'
import type { PublicDnsRecord } from '../src/mail-dns-health'

const CLOUDFLARE_NS = ['alex.ns.cloudflare.com', 'melany.ns.cloudflare.com']

describe('env file keys', () => {
  it('reads the keys set to something, never the values', () => {
    const keys = envFileKeys([
      '# comment',
      'CLOUDFLARE_API_TOKEN="encrypted:v2:abc"',
      'export PORKBUN_API_KEY=pk1_x',
      'PORKBUN_SECRET_KEY=',
      'EMPTY_QUOTED=""',
      '',
    ].join('\n'))
    expect([...keys].sort()).toEqual(['CLOUDFLARE_API_TOKEN', 'PORKBUN_API_KEY'])
  })

  it('names the file a deploy to each environment loads', () => {
    expect(envFileForEnvironment()).toBe('.env.production')
    expect(envFileForEnvironment('staging')).toBe('.env.staging')
  })
})

describe('dnsCredentialPresence', () => {
  it('prefers the env file as the reported source', () => {
    expect(dnsCredentialPresence('cloudflare', new Set(['CLOUDFLARE_API_TOKEN']), { CLOUDFLARE_API_TOKEN: 'x' }))
      .toEqual({ provider: 'cloudflare', configured: true, source: 'file', missing: [] })
    expect(dnsCredentialPresence('cloudflare', new Set(), { CLOUDFLARE_API_TOKEN: 'x' }).source).toBe('environment')
  })

  it('needs every key of one alternative', () => {
    expect(dnsCredentialPresence('porkbun', new Set(['PORKBUN_API_KEY']), {}))
      .toEqual({ provider: 'porkbun', configured: false, missing: ['PORKBUN_SECRET_KEY'] })
    // Route 53 takes static keys or a profile.
    expect(dnsCredentialPresence('route53', new Set(), { AWS_PROFILE: 'prod' }).configured).toBe(true)
  })
})

describe('dnsCredentialFix', () => {
  it('names the command for the provider the zone is on', () => {
    expect(dnsCredentialFix('cloudflare')).toBe('the zone is on Cloudflare: buddy env:set CLOUDFLARE_API_TOKEN <value> -f .env.production, then deploy again.')
    expect(dnsCredentialFix('porkbun', '.env.staging')).toContain('buddy env:set PORKBUN_API_KEY <value> -f .env.staging && buddy env:set PORKBUN_SECRET_KEY <value> -f .env.staging')
  })

  it('says to publish by hand when no provider Stacks drives holds the zone', () => {
    expect(dnsCredentialFix(null, '.env.production', ['ns1.namecheaphosting.com'])).toContain('ns1.namecheaphosting.com')
    expect(dnsCredentialFix(null)).toContain('by hand')
  })
})

describe('describeMailDnsProvider', () => {
  const base = { domain: 'stacksjs.com', zone: 'stacksjs.com', nameservers: CLOUDFLARE_NS, envFile: '.env.production' }

  it('warns, with the fix, when the zone\'s provider has no credentials (the stacksjs.com case)', () => {
    const result = describeMailDnsProvider({ ...base, fileKeys: new Set(['PORKBUN_API_KEY', 'PORKBUN_SECRET_KEY']), env: {} })
    expect(result.status).toBe('warn')
    expect(result.message).toContain('stacksjs.com is on Cloudflare')
    expect(result.message).toContain('CLOUDFLARE_API_TOKEN is not set')
    expect(result.message).toContain('buddy env:set CLOUDFLARE_API_TOKEN <value> -f .env.production')
  })

  it('passes when the key is in the production env file, without printing it', () => {
    const result = describeMailDnsProvider({ ...base, fileKeys: new Set(['CLOUDFLARE_API_TOKEN']), env: { CLOUDFLARE_API_TOKEN: 'secret-token-value' } })
    expect(result).toEqual({ status: 'pass', message: 'stacksjs.com is on Cloudflare; credentials found in .env.production' })
    expect(result.message).not.toContain('secret-token-value')
  })

  it('says when the key is only in this shell', () => {
    const result = describeMailDnsProvider({ ...base, fileKeys: new Set(), env: { CLOUDFLARE_API_TOKEN: 'x' } })
    expect(result.status).toBe('pass')
    expect(result.message).toContain('not .env.production')
  })

  it('warns when the declared provider is not the one the nameservers name', () => {
    const result = describeMailDnsProvider({ ...base, declared: 'porkbun', fileKeys: new Set(['CLOUDFLARE_API_TOKEN']), env: {} })
    expect(result.status).toBe('warn')
    expect(result.message).toContain('declares \'porkbun\'')
    expect(result.message).toContain('Cloudflare')
  })

  it('warns for nameservers no deploy can write, and for none at all', () => {
    expect(describeMailDnsProvider({ ...base, nameservers: ['dns1.registrar-servers.com'], fileKeys: new Set(), env: {} }).message).toContain('which no deploy can write')
    expect(describeMailDnsProvider({ ...base, nameservers: [], fileKeys: new Set(), env: {} }).status).toBe('warn')
  })
})

describe('describeMailDnsRecords', () => {
  const domain = 'example.com'
  const good: PublicDnsRecord[] = [
    { name: domain, type: 'MX', content: 'mail.example.com' },
    { name: domain, type: 'TXT', content: 'v=spf1 ip4:203.0.113.7 ~all' },
    { name: domain, type: 'TXT', content: 'google-site-verification=abc' },
    { name: `_dmarc.${domain}`, type: 'TXT', content: 'v=DMARC1; p=quarantine; rua=mailto:a@example.com' },
    { name: `mail._domainkey.${domain}`, type: 'TXT', content: 'v=DKIM1; k=rsa; p=MIIB' },
  ]

  it('passes when each record is published once and agrees with config', () => {
    expect(describeMailDnsRecords({ domain, records: good, dkimSelector: 'mail', mxAddresses: ['203.0.113.7'] }).status).toBe('pass')
  })

  it('names what is missing or duplicated', () => {
    const records = [...good.filter(record => !record.name.startsWith('_dmarc')), { name: domain, type: 'TXT' as const, content: 'v=spf1 -all' }]
    const result = describeMailDnsRecords({ domain, records, dkimSelector: 'mail' })
    expect(result.status).toBe('warn')
    expect(result.message).toContain('DMARC: nothing published')
    expect(result.message).toContain('SPF: 2 records')
  })

  it('treats a DKIM miss as unverified, since only a deploy knows the selector', () => {
    const result = describeMailDnsRecords({ domain, records: good, dkimSelector: 'stacks' })
    expect(result.message).toContain('nothing at stacks._domainkey')
    expect(result.message).toContain('may differ')
  })

  it('reports a live DMARC policy that config has moved away from', () => {
    expect(describeMailDnsRecords({ domain, records: good, dkimSelector: 'mail', dmarcPolicy: 'reject' }).message).toContain('p=quarantine, config says p=reject')
  })

  it('reports SPF that does not authorize the MX host, unless it delegates', () => {
    expect(describeMailDnsRecords({ domain, records: good, dkimSelector: 'mail', mxAddresses: ['198.51.100.1'] }).message).toContain('does not authorize 198.51.100.1')
    const delegated = good.map(record => record.content.startsWith('v=spf1') ? { ...record, content: 'v=spf1 include:_spf.google.com ~all' } : record)
    expect(describeMailDnsRecords({ domain, records: delegated, dkimSelector: 'mail', mxAddresses: ['198.51.100.1'] }).status).toBe('pass')
  })
})

describe('describePostmaster', () => {
  const token = 'tEYT8VqGcB7WEF_vRq55p8HWJhmL0rD-uqIjM8fNbKg'

  it('asks for it when unset, and is quiet when turned off', () => {
    expect(describePostmaster('example.com', undefined, []).message).toContain('postmaster.google.com')
    expect(describePostmaster('example.com', false, []).status).toBe('pass')
  })

  it('knows configured from published', () => {
    expect(describePostmaster('example.com', { google: token }, []).message).toContain('does not publish it yet')
    expect(describePostmaster('example.com', { google: token }, [`google-site-verification=${token}`]).status).toBe('pass')
  })
})

describe('joinTxtAnswers', () => {
  it('passes grouped answers through and rejoins flattened 255-byte chunks', () => {
    const head = 'a'.repeat(255)
    expect(joinTxtAnswers([[head, 'tail'], ['v=spf1 -all']])).toEqual([`${head}tail`, 'v=spf1 -all'])
    // Bun's shape: every character-string as its own record.
    expect(joinTxtAnswers([[head], ['tail'], ['v=spf1 -all']])).toEqual([`${head}tail`, 'v=spf1 -all'])
    expect(joinTxtAnswers([['short'], ['other']])).toEqual(['short', 'other'])
  })
})

describe('mailDomainFromConfig', () => {
  it('prefers email.domain, then the from-address', () => {
    expect(mailDomainFromConfig({ domain: 'Example.com', from: { address: 'a@other.com' } })).toBe('example.com')
    expect(mailDomainFromConfig({ from: { address: 'hi@other.com' } })).toBe('other.com')
    expect(mailDomainFromConfig({})).toBeUndefined()
  })
})
