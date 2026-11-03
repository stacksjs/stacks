/**
 * Reading a zone over public DNS, which `dns:diff` always does and `dns:sync`
 * and `dns:pull` do without registrar credentials (stacksjs/stacks#3153).
 * Only the apex and `www` used to be looked up, so every other declared name
 * read as missing, and a `www` CNAME was followed and pulled as A records.
 */
import type { DnsConfig } from '@stacksjs/types'
import type { DnsResolver } from '../src/sync'
import { describe, expect, test } from 'bun:test'
import { renderDnsConfig, resolveLiveRecords, syncDnsConfig } from '../src/sync'

const zone = 'example.test'

/** A zone held in memory: name -> type -> answers. A miss rejects, as node:dns does. */
function fakeResolver(records: Record<string, Partial<Record<'A' | 'AAAA' | 'CNAME' | 'TXT' | 'MX' | 'NS', unknown[]>>>): DnsResolver {
  const answer = (type: 'A' | 'AAAA' | 'CNAME' | 'TXT' | 'MX' | 'NS') => async (name: string): Promise<any[]> => {
    const found = records[name]?.[type]
    if (!found?.length) throw Object.assign(new Error(`queryData ENODATA ${name}`), { code: 'ENODATA' })
    return found
  }
  return {
    resolve4: answer('A'),
    resolve6: answer('AAAA'),
    resolveCname: answer('CNAME'),
    resolveTxt: answer('TXT'),
    resolveMx: answer('MX'),
    resolveNs: answer('NS'),
  }
}

const live = fakeResolver({
  [zone]: { A: ['203.0.113.10'], NS: ['ns1.example.net'] },
  // An address lookup on an alias answers with the target's addresses.
  [`www.${zone}`]: { CNAME: ['cdn.example.net'], A: ['198.51.100.7'] },
  [`_dmarc.${zone}`]: { TXT: [['v=DMARC1; p=reject']] },
  [`resend._domainkey.${zone}`]: { TXT: [['p=MIGfMA0', 'GCSqGSIb3']] },
  [`mail.${zone}`]: { MX: [{ priority: 10, exchange: 'feedback-smtp.example.net' }] },
})

describe('dns:diff over public DNS', () => {
  test('a declared record under any name is looked up, so a live one is kept', async () => {
    const cfg: DnsConfig = {
      a: [{ name: '@', address: '203.0.113.10', ttl: 600 }],
      cname: [{ name: 'www', target: 'cdn.example.net', ttl: 'auto' }],
      txt: [
        { name: '_dmarc', content: 'v=DMARC1; p=reject', ttl: 'auto' },
        { name: 'resend._domainkey', content: 'p=MIGfMA0GCSqGSIb3', ttl: 'auto' },
      ],
      mx: [{ name: 'mail', mailServer: 'feedback-smtp.example.net', priority: 10, ttl: 'auto' }],
    } as DnsConfig
    const { plan } = await syncDnsConfig(zone, cfg, { dryRun: true, resolver: live })
    expect(plan.items.map(item => `${item.action} ${item.record.type} ${item.record.name}`)).toEqual([
      `keep TXT _dmarc.${zone}`,
      `keep TXT resend._domainkey.${zone}`,
      `keep A ${zone}`,
      `keep CNAME www.${zone}`,
      `keep MX mail.${zone}`,
    ])
  })

  test('a record that really is missing is still planned for creation', async () => {
    const cfg = { txt: [{ name: '_dmarc', content: 'v=DMARC1; p=none', ttl: 'auto' }], cname: [{ name: 'docs', target: 'docs.example.net', ttl: 'auto' }] } as DnsConfig
    const { plan } = await syncDnsConfig(zone, cfg, { dryRun: true, resolver: live })
    expect(plan.create.map(record => `${record.type} ${record.name}`)).toEqual([`TXT _dmarc.${zone}`, `CNAME docs.${zone}`])
  })

  test('a name outside the zone is not looked up', async () => {
    const asked: string[] = []
    const spy: DnsResolver = Object.fromEntries(Object.entries(live).map(([key, fn]) =>
      [key, (name: string) => { asked.push(name); return (fn as (name: string) => Promise<unknown>)(name) }])) as unknown as DnsResolver
    await resolveLiveRecords(zone, ['elsewhere.example.org', `api.${zone}`], spy)
    expect(asked).not.toContain('elsewhere.example.org')
    expect(asked).toContain(`api.${zone}`)
  })
})

describe('dns:pull', () => {
  test('a www alias is pulled as a CNAME, never as the addresses it points at', async () => {
    const source = renderDnsConfig(zone, await resolveLiveRecords(zone, [], live))
    expect(source).toContain(`{ name: 'www', target: 'cdn.example.net', ttl: 'auto' }`)
    expect(source).not.toContain('198.51.100.7')
    expect(source).toContain(`{ name: '@', address: '203.0.113.10', ttl: 600 }`)
  })
})
