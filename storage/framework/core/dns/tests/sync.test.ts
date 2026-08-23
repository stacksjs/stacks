/**
 * `config/dns.ts` reconciliation: what a declared record resolves to, what
 * gets created, and what happens to the ones that cannot be published.
 *
 * All three behaviours here were bugs found in a production deploy log that
 * said only "0 created, 1 kept, 1 failed":
 *
 *   - `{ name: 'www', address: '@' }` (the framework's own scaffold, and how
 *     every registrar UI spells "same address as the apex") went to the
 *     registrar as an A record whose content was the literal `@`. Cloudflare
 *     rejected it once per deploy, per zone that had no www record yet.
 *   - `{ name: env.APP_DOMAIN }` (also the scaffold) was treated as a relative
 *     label, so the apex of stacksjs.com was published as
 *     `stacksjs.com.stacksjs.com`.
 *   - The reason the registrar gave was thrown away by `catch { failed += 1 }`,
 *     which is why the log could not say which record or why.
 */
import type { DnsProvider } from '@stacksjs/ts-cloud'
import type { DnsConfig } from '@stacksjs/types'
import { describe, expect, test } from 'bun:test'
import { desiredDnsRecords, planDnsSync, syncDnsConfig } from '../src/sync'

const ZONE = 'example.com'

function cfg(overrides: Partial<DnsConfig> = {}): DnsConfig {
  return { a: [], aaaa: [], cname: [], mx: [], txt: [], ...overrides } as DnsConfig
}

/** A provider that records what it was asked to create and answers as told. */
function stubProvider(answers: Record<string, { success: boolean, message?: string } | Error>): DnsProvider & { asked: string[] } {
  const asked: string[] = []

  return {
    name: 'stub',
    asked,
    async listRecords() {
      return { success: true, records: [] }
    },
    async createRecord(_domain: string, record: any) {
      asked.push(`${record.type} ${record.name}`)
      const answer = answers[record.name]
      if (answer instanceof Error)
        throw answer

      return answer ?? { success: true }
    },
  } as unknown as DnsProvider & { asked: string[] }
}

describe('record names', () => {
  test('every spelling of the apex resolves to the zone itself', () => {
    for (const name of ['@', '', ZONE, `${ZONE}.`, ZONE.toUpperCase()]) {
      const [record] = desiredDnsRecords(ZONE, cfg({ a: [{ name, address: '203.0.113.10' }] }))
      expect(record.name, `name: ${JSON.stringify(name)}`).toBe(ZONE)
    }
  })

  test('a relative label is joined to the zone, and an absolute one is left alone', () => {
    const records = desiredDnsRecords(ZONE, cfg({
      a: [
        { name: 'www', address: '203.0.113.10' },
        { name: `docs.${ZONE}`, address: '203.0.113.10' },
        { name: 'a.b', address: '203.0.113.10' },
      ],
    }))

    expect(records.map(r => r.name)).toEqual([`www.${ZONE}`, `docs.${ZONE}`, `a.b.${ZONE}`])
  })
})

describe('the @ alias in a record value', () => {
  test('an A or AAAA address of @ copies the apex record declared beside it', () => {
    const records = desiredDnsRecords(ZONE, cfg({
      a: [{ name: '@', address: '203.0.113.10' }, { name: 'www', address: '@' }],
      aaaa: [{ name: '@', address: '2001:db8::1' }, { name: 'www', address: '@' }],
    }))

    expect(records.filter(r => r.type === 'A').map(r => r.content)).toEqual(['203.0.113.10', '203.0.113.10'])
    expect(records.filter(r => r.type === 'AAAA').map(r => r.content)).toEqual(['2001:db8::1', '2001:db8::1'])
  })

  test('a CNAME target of @ is the zone, which needs no address to copy', () => {
    const [record] = desiredDnsRecords(ZONE, cfg({ cname: [{ name: 'docs', target: '@' }] }))

    expect(record.content).toBe(ZONE)
  })

  test('an unresolvable @ is skipped with a reason, never sent to the registrar', () => {
    // The exact shape that failed in production: a www alias with no apex A
    // declared anywhere in the config.
    const plan = planDnsSync(desiredDnsRecords(ZONE, cfg({ a: [{ name: 'www', address: '@' }] })), [], { zone: ZONE })

    expect(plan.create).toEqual([])
    expect(plan.skip).toHaveLength(1)
    expect(plan.skip[0].reason).toContain('copies the apex')
  })
})

describe('the plan', () => {
  test('creates what is missing and keeps what is already there', () => {
    const desired = desiredDnsRecords(ZONE, cfg({
      a: [{ name: '@', address: '203.0.113.10' }, { name: 'www', address: '203.0.113.10' }],
    }))
    const plan = planDnsSync(desired, [{ name: ZONE, type: 'A', content: '198.51.100.7', ttl: 600 }], { zone: ZONE })

    // Single-valued and already present: left exactly as it is, never overwritten.
    expect(plan.keep.map(r => r.name)).toEqual([ZONE])
    expect(plan.create.map(r => r.name)).toEqual([`www.${ZONE}`])
  })

  test('a TXT record is matched on content, so a second value is additive', () => {
    const desired = desiredDnsRecords(ZONE, cfg({ txt: [{ name: '@', content: 'v=spf1 -all' }] }))

    expect(planDnsSync(desired, [{ name: ZONE, type: 'TXT', content: '"v=spf1 -all"', ttl: 600 }], { zone: ZONE }).keep).toHaveLength(1)
    expect(planDnsSync(desired, [{ name: ZONE, type: 'TXT', content: 'something-else', ttl: 600 }], { zone: ZONE }).create).toHaveLength(1)
  })

  test('a placeholder address is skipped as its own outcome, not disguised as kept', () => {
    // It used to land in `keep`, which reads as "already present" - so the
    // scaffold's 10.0.0.1 looked like a satisfied record forever.
    const plan = planDnsSync(desiredDnsRecords(ZONE, cfg({ a: [{ name: '@', address: '10.0.0.1' }] })), [], { zone: ZONE })

    expect(plan.keep).toEqual([])
    expect(plan.create).toEqual([])
    expect(plan.skip[0].reason).toContain('private, loopback or placeholder')
  })

  test('a record outside the zone is skipped rather than published into it', () => {
    const plan = planDnsSync([{ name: 'elsewhere.test', type: 'A', content: '203.0.113.10', ttl: 600 }], [], { zone: ZONE })

    expect(plan.skip[0].reason).toContain(`outside the ${ZONE} zone`)
  })
})

describe('applying the plan', () => {
  test('a rejected record is reported with the registrar reason, not just counted', async () => {
    const provider = stubProvider({
      [`bad.${ZONE}`]: { success: false, message: 'Content for A record must be a valid IPv4 address' },
    })

    const result = await syncDnsConfig(ZONE, cfg({
      a: [{ name: 'good', address: '203.0.113.10' }, { name: 'bad', address: '203.0.113.11' }],
    }), { provider })

    expect(result.created).toBe(1)
    expect(result.failed).toBe(1)
    expect(result.failures).toHaveLength(1)
    expect(result.failures[0].record.name).toBe(`bad.${ZONE}`)
    expect(result.failures[0].reason).toContain('valid IPv4 address')
  })

  test('a thrown error is kept too, and never aborts the remaining records', async () => {
    const provider = stubProvider({ [`first.${ZONE}`]: new Error('502 from registrar') })

    const result = await syncDnsConfig(ZONE, cfg({
      a: [{ name: 'first', address: '203.0.113.10' }, { name: 'second', address: '203.0.113.11' }],
    }), { provider })

    expect(result.failures.map(f => f.reason)).toEqual(['502 from registrar'])
    expect(result.created).toBe(1)
    expect(provider.asked).toHaveLength(2)
  })

  test('skipped records reach the caller, so a deploy can say what it ignored', async () => {
    const provider = stubProvider({})
    const result = await syncDnsConfig(ZONE, cfg({ a: [{ name: '@', address: '10.0.0.1' }] }), { provider })

    expect(provider.asked).toEqual([])
    expect(result.skipped).toHaveLength(1)
    expect(result.skipped[0].record.name).toBe(ZONE)
  })
})
