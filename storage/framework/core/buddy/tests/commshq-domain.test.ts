import type { PublishResult, SendingDomainRecord } from '../src/commshq-domain'
import { describe, expect, it } from 'bun:test'
import { parseSendingDomain, sendingDomainFor, setUpSendingDomain } from '../src/commshq-domain'

const RECORDS: SendingDomainRecord[] = [
  { type: 'TXT', name: '_commshq-verify.votescape.org', content: 'commshq-verify=abc', purpose: 'ownership' },
  { type: 'TXT', name: 'commshq._domainkey.votescape.org', content: 'v=DKIM1; k=rsa; p=AAAA', purpose: 'dkim' },
  { type: 'TXT', name: '_dmarc.votescape.org', content: 'v=DMARC1; p=none', purpose: 'dmarc' },
]

/** A CommsHQ that verifies once its records are in the zone, and a DNS provider that keeps what it is given. */
function world(options: { verifiesOnAttempt?: number, provider?: string | null, existing?: string[], status?: string } = {}) {
  const zone = new Map<string, string>((options.existing ?? []).map(name => [name, 'already here']))
  const calls: string[] = []
  const printed: string[] = []
  let verifies = 0
  let slept = 0

  const state = (status: string, checks?: Record<string, boolean>) => ({ data: { domain: 'votescape.org', status, from: 'Votescape via CommsHQ <no-reply@commshq.org>', records: RECORDS, checks } })

  return {
    zone,
    calls,
    printed,
    slept: () => slept,
    deps: {
      fetch: async (url: string, init?: RequestInit) => {
        const path = new URL(url).pathname
        calls.push(`${init?.method} ${path} ${(init?.headers as Record<string, string>).Authorization}`)
        if (path.endsWith('/verify')) {
          verifies++
          const done = options.verifiesOnAttempt !== undefined && verifies >= options.verifiesOnAttempt
          return Response.json(state(done ? 'verified' : 'pending', { ownership: true, dkim: done }))
        }
        return Response.json(state(options.status ?? 'pending'))
      },
      publish: async (_zone: string, records: SendingDomainRecord[]): Promise<PublishResult> => {
        if (options.provider === null)
          return { provider: null, created: 0, kept: 0, failures: [] }
        let created = 0
        let kept = 0
        for (const record of records) {
          if (zone.has(record.name)) {
            kept++
            continue
          }
          zone.set(record.name, record.content)
          created++
        }
        return { provider: options.provider ?? 'porkbun', created, kept, failures: [] }
      },
      print: (line: string) => printed.push(line),
      sleep: async () => { slept++ },
    },
  }
}

const OPTIONS = { url: 'https://commshq.test', key: 'chq_send_key', domain: 'votescape.org' }

describe('the domain an app sends from', () => {
  it('is the one in its From address, else the one it is served on', () => {
    expect(sendingDomainFor({ mailFrom: 'noreply@mail.votescape.org', appUrl: 'https://votescape.org' })).toBe('mail.votescape.org')
    expect(sendingDomainFor({ appUrl: 'https://www.votescape.org/' })).toBe('votescape.org')
    expect(sendingDomainFor({ appUrl: 'votescape.org' })).toBe('votescape.org')
  })

  it('is nothing for an address mail cannot come from', () => {
    expect(sendingDomainFor({ mailFrom: 'hello@example.com', appUrl: 'http://localhost:3000' })).toBeUndefined()
    expect(sendingDomainFor({ appUrl: 'https://votescape.localhost' })).toBeUndefined()
    expect(sendingDomainFor({ appUrl: 'http://127.0.0.1' })).toBeUndefined()
    expect(sendingDomainFor({})).toBeUndefined()
  })
})

describe('what CommsHQ may ask an app to publish', () => {
  it('is TXT records inside the sending domain, and nothing else', () => {
    const parsed = parseSendingDomain({ data: { domain: 'votescape.org', status: 'pending', records: [
      ...RECORDS,
      { type: 'TXT', name: 'votescape.org.evil.test', content: 'x', purpose: 'dkim' },
      { type: 'TXT', name: 'other.org', content: 'x', purpose: 'dkim' },
      { type: 'A', name: 'votescape.org', content: '203.0.113.1', purpose: 'address' },
      { type: 'TXT', name: 'a.votescape.org', content: 'two\nlines', purpose: 'dkim' },
    ] } }, 'votescape.org')
    expect(parsed?.records.map(record => record.name)).toEqual(RECORDS.map(record => record.name))
  })

  it('is nothing when the answer is about another domain', () => {
    expect(parseSendingDomain({ data: { domain: 'other.org', status: 'pending', records: RECORDS } }, 'votescape.org')).toBeNull()
    expect(parseSendingDomain({ error: 'nope' }, 'votescape.org')).toBeNull()
  })
})

describe('setting up a sending domain', () => {
  it('registers the domain, publishes its records and has CommsHQ verify it', async () => {
    const w = world({ verifiesOnAttempt: 1 })
    const outcome = await setUpSendingDomain(OPTIONS, w.deps)

    expect(outcome.status).toBe('verified')
    expect([...w.zone.keys()]).toEqual(RECORDS.map(record => record.name))
    expect(w.calls).toEqual([
      'POST /api/v1/sending-domain Bearer chq_send_key',
      'POST /api/v1/sending-domain/verify Bearer chq_send_key',
    ])
    expect(w.printed.join('\n')).toContain('3 DNS record(s) published through porkbun')
    expect(w.printed.join('\n')).toContain('votescape.org is verified')
  })

  it('creates only what is missing', async () => {
    const w = world({ verifiesOnAttempt: 1, existing: ['_dmarc.votescape.org'] })
    const outcome = await setUpSendingDomain(OPTIONS, w.deps)
    expect(outcome.published).toMatchObject({ created: 2, kept: 1 })
    // The DMARC record that was there is the one still there.
    expect(w.zone.get('_dmarc.votescape.org')).toBe('already here')
  })

  it('asks again while DNS catches up, then says mail goes out from CommsHQ until it does', async () => {
    const slow = world({ verifiesOnAttempt: 3 })
    expect((await setUpSendingDomain({ ...OPTIONS, verifyAttempts: 3 }, slow.deps)).status).toBe('verified')
    expect(slow.slept()).toBe(2)

    const never = world()
    const outcome = await setUpSendingDomain({ ...OPTIONS, verifyAttempts: 2 }, never.deps)
    expect(outcome.status).toBe('pending')
    expect(never.printed.join('\n')).toContain('not seen in DNS: dkim')
    expect(never.printed.join('\n')).toContain('Votescape via CommsHQ <no-reply@commshq.org>')
  })

  it('does nothing more once the domain is verified', async () => {
    const w = world({ status: 'verified' })
    expect((await setUpSendingDomain(OPTIONS, w.deps)).status).toBe('verified')
    expect(w.zone.size).toBe(0)
    expect(w.calls).toHaveLength(1)
  })

  it('prints the records to publish by hand when no configured provider holds the zone', async () => {
    const w = world({ provider: null })
    const outcome = await setUpSendingDomain(OPTIONS, w.deps)
    expect(outcome.status).toBe('pending')
    expect(w.printed.join('\n')).toContain('TXT commshq._domainkey.votescape.org  v=DKIM1; k=rsa; p=AAAA')
    // Nothing to verify: the records are not there.
    expect(w.calls).toHaveLength(1)
  })

  it('never throws: an unreachable or older CommsHQ is reported, not raised', async () => {
    const w = world()
    const down = await setUpSendingDomain(OPTIONS, { ...w.deps, fetch: async () => { throw new Error('offline') } })
    expect(down).toMatchObject({ status: 'failed', detail: 'CommsHQ could not be reached' })
    const old = await setUpSendingDomain(OPTIONS, { ...w.deps, fetch: async () => new Response('{}', { status: 404 }) })
    expect(old.status).toBe('skipped')
  })
})
