/**
 * Regression coverage for the mail DNS a deploy publishes.
 *
 * Two failures sit behind these tests, both of which produce a zone that looks
 * perfectly well-formed while mail silently fails at the receiving end — the
 * category of bug that is only ever found by a reader reporting they never got
 * a confirmation email.
 *
 * 1. THE SELECTOR AND KEY MUST BE THE ONES THE SERVER ACTUALLY SIGNS WITH.
 *    The mail daemon registers the global `DKIM_DOMAIN` signer first and then
 *    *silently drops* any `DKIM_EXTRA_KEYS` entry for a domain that already has
 *    a signer (`configureDkim` in delivery/outbound.zig returns early on a
 *    duplicate). So for the one domain that IS `DKIM_DOMAIN`, the per-domain
 *    key the deploy generates is dead on disk and the server keeps signing with
 *    `DKIM_PRIVATE_KEY_PATH` under `DKIM_SELECTOR`. Publishing the per-domain
 *    key there advertises a key nothing signs with, and every message fails
 *    DKIM. Verified on the live box: `mail.private` and `stacksjs.com.private`
 *    are different keys, and the published record matches the former.
 *
 *    The provisioning script therefore reports the EFFECTIVE key and selector,
 *    and this publisher must use the reported selector rather than assume
 *    `mail`.
 *
 * 2. THE DMARC POLICY MUST COME FROM CONFIG. It was hardcoded to
 *    `p=quarantine`, so a young domain declaring `p=none` got quarantine
 *    anyway.
 */

import { describe, expect, it } from 'bun:test'
import { dnsProviderConfigsFromEnv, findMailDnsAnomalies, planTxtReplacement, resolveDmarcPolicy, selectRecordsAt, txtContent, zoneFqdn } from '../src/commands/deploy'

/**
 * Mirrors the publisher's selector derivation. `mail` is the fallback only for
 * a tenant provisioned before the selector was reported — never an assumption
 * about what the server chose.
 */
function dkimRecordName(dkimSelector?: string): string {
  return `${dkimSelector || 'mail'}._domainkey`
}

describe('DKIM record name', () => {
  it('uses the selector the server reported', () => {
    expect(dkimRecordName('mail')).toBe('mail._domainkey')
  })

  it('follows a global signer whose selector is not `mail`', () => {
    // The domain that collides with DKIM_DOMAIN inherits DKIM_SELECTOR, which
    // need not be `mail`. Hardcoding `mail` publishes the key under a selector
    // no signature ever references.
    expect(dkimRecordName('s1')).toBe('s1._domainkey')
    expect(dkimRecordName('default')).toBe('default._domainkey')
  })

  it('falls back to `mail` only when nothing was reported', () => {
    expect(dkimRecordName(undefined)).toBe('mail._domainkey')
    expect(dkimRecordName('')).toBe('mail._domainkey')
  })
})

describe('finding the existing record to replace', () => {
  /**
   * The bug this covers reached production. `listRecords(domain, type)` is not
   * a portable server-side filter — Porkbun scopes it to the zone apex — so a
   * TXT listing came back holding the apex SPF and nothing else. `_dmarc` and
   * `mail._domainkey` looked absent, the replacement found nothing to remove,
   * and it created a SECOND `_dmarc` record beside the old one. Under RFC 7489
   * a domain with two DMARC records has no usable policy at all, so the deploy
   * that was meant to relax quarantine to none removed DMARC entirely.
   *
   * Selection therefore happens here, over a full zone listing.
   */
  const zone = 'theopentimes.org'
  const fullZone = [
    { type: 'TXT', name: 'theopentimes.org', content: 'v=spf1 ip4:178.105.248.188 ~all' },
    { type: 'TXT', name: 'theopentimes.org', content: 'google-site-verification=abc' },
    { type: 'TXT', name: '_dmarc.theopentimes.org', content: 'v=DMARC1; p=quarantine; rua=mailto:no-reply@theopentimes.org' },
    { type: 'TXT', name: 'mail._domainkey.theopentimes.org', content: 'v=DKIM1; k=rsa; p=AAAA' },
    { type: 'MX', name: 'theopentimes.org', content: 'mail.theopentimes.org' },
    { type: 'A', name: 'mail.theopentimes.org', content: '178.105.248.188' },
  ]

  it('finds a subdomain TXT record, not just apex ones', () => {
    const found = selectRecordsAt(fullZone, `_dmarc.${zone}`, 'TXT', zone)

    expect(found).toHaveLength(1)
    expect(found[0]!.content).toContain('p=quarantine')
  })

  it('finds the DKIM record under its selector', () => {
    expect(selectRecordsAt(fullZone, `mail._domainkey.${zone}`, 'TXT', zone)).toHaveLength(1)
  })

  it('separates the two apex TXT records from every subdomain one', () => {
    expect(selectRecordsAt(fullZone, zone, 'TXT', zone)).toHaveLength(2)
  })

  it('does not confuse types at the same name', () => {
    expect(selectRecordsAt(fullZone, zone, 'MX', zone)).toHaveLength(1)
    expect(selectRecordsAt(fullZone, `mail.${zone}`, 'A', zone)).toHaveLength(1)
  })

  it('normalizes however a provider spells a name', () => {
    // Relative, absolute, apex-as-@ and apex-as-empty all name the same thing.
    expect(zoneFqdn('_dmarc', zone)).toBe(`_dmarc.${zone}`)
    expect(zoneFqdn('_dmarc.theopentimes.org.', zone)).toBe(`_dmarc.${zone}`)
    expect(zoneFqdn('@', zone)).toBe(zone)
    expect(zoneFqdn('', zone)).toBe(zone)
    expect(zoneFqdn('_DMARC.TheOpenTimes.ORG', zone)).toBe(`_dmarc.${zone}`)

    const relative = [{ type: 'TXT', name: '_dmarc', content: 'v=DMARC1; p=none' }]
    expect(selectRecordsAt(relative, `_dmarc.${zone}`, 'TXT', zone)).toHaveLength(1)
  })
})

describe('replacing a TXT record in a shared name', () => {
  const isSpf = (content: string): boolean => content.toLowerCase().startsWith('v=spf1')
  const spf = 'v=spf1 ip4:178.105.248.188 ~all'

  it('never removes a record this deploy does not own', () => {
    // The apex is shared: SPF lives beside ownership proofs that other
    // companies check on their own schedule. Deleting them is invisible until
    // a third party revokes a verification weeks later.
    const existing = [
      { content: 'google-site-verification=abc123' },
      { content: 'v=spf1 ip4:203.0.113.9 ~all' },
      { content: 'atlassian-domain-verification=xyz' },
      { content: 'MS=ms12345678' },
    ]

    const { remove, create } = planTxtReplacement(existing, spf, isSpf)

    expect(create).toBe(true)
    expect(remove).toEqual([{ content: 'v=spf1 ip4:203.0.113.9 ~all' }])
    for (const record of remove)
      expect(isSpf(txtContent(record))).toBe(true)
  })

  it('writes nothing when the record is already exactly right', () => {
    // A no-op deploy must be a no-op: rewriting a correct record churns the
    // zone's serial and briefly leaves the name empty for every resolver.
    const { remove, create } = planTxtReplacement([{ content: spf }], spf, isSpf)

    expect(create).toBe(false)
    expect(remove).toEqual([])
  })

  it('collapses a name that somehow grew two of ours', () => {
    // Two SPF records is a permanent DKIM/SPF failure at the receiver, so both
    // go and one correct record replaces them.
    const existing = [{ content: spf }, { content: 'v=spf1 include:old.example ~all' }]
    const { remove, create } = planTxtReplacement(existing, spf, isSpf)

    expect(create).toBe(true)
    expect(remove).toHaveLength(2)
  })

  it('creates the record when the name is empty', () => {
    expect(planTxtReplacement([], spf, isSpf)).toEqual({ remove: [], create: true })
  })

  it('reads provider records that use `value` or arrive quoted', () => {
    // Providers disagree on both, and a mismatch here reads as "not ours" —
    // which would leave a stale record in place beside a new one.
    expect(txtContent({ value: `"${spf}"` })).toBe(spf)
    expect(planTxtReplacement([{ value: `"${spf}"` }], spf, isSpf).create).toBe(false)
  })
})

describe('DNS provider credentials', () => {
  it('offers every provider whose credentials are present, not just Porkbun', () => {
    const saved = { ...process.env }
    try {
      for (const key of ['PORKBUN_API_KEY', 'PORKBUN_SECRET_KEY', 'CLOUDFLARE_API_TOKEN', 'GODADDY_API_KEY', 'GODADDY_API_SECRET', 'AWS_ACCESS_KEY_ID', 'AWS_PROFILE'])
        delete process.env[key]

      expect(dnsProviderConfigsFromEnv()).toEqual([])

      process.env.AWS_PROFILE = 'default'
      process.env.CLOUDFLARE_API_TOKEN = 'token'
      // A mail domain in Route53 or Cloudflare used to be skipped outright,
      // because the mail path read PORKBUN_API_KEY and nothing else.
      expect(dnsProviderConfigsFromEnv().map(c => c.provider).sort()).toEqual(['cloudflare', 'route53'])
    }
    finally {
      for (const key of Object.keys(process.env))
        if (!(key in saved)) delete process.env[key]
      Object.assign(process.env, saved)
    }
  })
})

describe('reading the zone back after publishing', () => {
  /**
   * The last line of defence, and the one that was missing when `p=none` was
   * published beside an existing `p=quarantine`. Every individual record was
   * well-formed, the deploy logged success, and the zone looked more configured
   * than before — while the domain had actually lost DMARC, because RFC 7489
   * has receivers discard a duplicated record set rather than pick one.
   *
   * Checking the result instead of the intent catches whatever the cause was:
   * a provider listing scoped differently than expected, a delete that failed,
   * a record added by hand, or a second tool writing the same zone.
   */
  const zone = 'theopentimes.org'
  const expectations = [
    { label: 'MX', fqdn: zone, type: 'MX' },
    { label: 'SPF', fqdn: zone, type: 'TXT', owns: (c: string) => c.toLowerCase().startsWith('v=spf1') },
    { label: 'DKIM', fqdn: `mail._domainkey.${zone}`, type: 'TXT' },
    { label: 'DMARC', fqdn: `_dmarc.${zone}`, type: 'TXT', owns: (c: string) => c.toLowerCase().startsWith('v=dmarc1') },
  ]
  const healthy = [
    { type: 'MX', name: zone, content: `mail.${zone}` },
    { type: 'TXT', name: zone, content: 'v=spf1 ip4:178.105.248.188 ~all' },
    { type: 'TXT', name: zone, content: 'google-site-verification=abc' },
    { type: 'TXT', name: `mail._domainkey.${zone}`, content: 'v=DKIM1; k=rsa; p=AAAA' },
    { type: 'TXT', name: `_dmarc.${zone}`, content: 'v=DMARC1; p=none; rua=mailto:chris@theopentimes.org' },
  ]

  it('is silent on a correctly published zone', () => {
    expect(findMailDnsAnomalies(healthy, expectations, zone)).toEqual([])
  })

  it('catches the duplicate DMARC that reached production', () => {
    const withDuplicate = [...healthy, { type: 'TXT', name: `_dmarc.${zone}`, content: 'v=DMARC1; p=quarantine; rua=mailto:no-reply@theopentimes.org' }]
    const problems = findMailDnsAnomalies(withDuplicate, expectations, zone)

    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('DMARC')
    expect(problems[0]).toContain('2 records')
  })

  it('catches a duplicated DKIM key, which fails the same way', () => {
    const withDuplicate = [...healthy, { type: 'TXT', name: `mail._domainkey.${zone}`, content: 'v=DKIM1; k=rsa; p=BBBB' }]
    expect(findMailDnsAnomalies(withDuplicate, expectations, zone)[0]).toContain('DKIM')
  })

  it('catches a record that never landed', () => {
    const missing = healthy.filter(r => !String(r.name).startsWith('_dmarc'))
    expect(findMailDnsAnomalies(missing, expectations, zone)[0]).toContain('nothing published')
  })

  it('does not mistake an unrelated apex TXT for a duplicate SPF', () => {
    // The apex legitimately holds many TXT records; only ours are counted.
    const busy = [...healthy, { type: 'TXT', name: zone, content: 'MS=ms12345678' }]
    expect(findMailDnsAnomalies(busy, expectations, zone)).toEqual([])
  })
})

describe('DMARC policy', () => {
  it('publishes each policy a project may declare', () => {
    expect(resolveDmarcPolicy('none')).toBe('none')
    expect(resolveDmarcPolicy('quarantine')).toBe('quarantine')
    expect(resolveDmarcPolicy('reject')).toBe('reject')
  })

  it('defaults to quarantine when a project says nothing', () => {
    expect(resolveDmarcPolicy(undefined)).toBe('quarantine')
  })

  it('never lets an unrecognised value reach the zone', () => {
    // Interpolated straight into a TXT record: a typo would publish a malformed
    // policy that receivers ignore, so the domain silently has no DMARC at all
    // while the record appears to exist.
    for (const bad of ['quaranine', 'NONE', 'p=none', '', null, 0, {}])
      expect(resolveDmarcPolicy(bad)).toBe('quarantine')
  })
})
