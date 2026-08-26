import { describe, expect, it } from 'bun:test'
import { normalizeDomains, orphanedFragmentDomains } from '../src/commands/deploy'

/**
 * What a deploy is allowed to take off the gateway.
 *
 * `/etc/rpx/sites.d/<slug>.json` is replaced wholesale, so a domain in the
 * copy on the box that the config does not account for is a domain this deploy
 * would silently stop serving. Usually that means the slug belongs to somebody
 * else. Sometimes it means a hostname is being retired on purpose, and the two
 * have to be distinguishable.
 */

const fragment = JSON.stringify({
  proxies: [
    { to: 'campushq.org', from: 'localhost:3160' },
    { to: 'www.campushq.org', redirect: { to: 'https://campushq.org' } },
    { to: 'dashboard.campushq.org', from: 'localhost:3169' },
    { to: 'campushq.stacksjs.com', from: 'localhost:3160' },
  ],
})

describe('orphanedFragmentDomains', () => {
  it('is empty when every domain on the box is declared', () => {
    const orphaned = orphanedFragmentDomains(fragment, [
      'campushq.org',
      'dashboard.campushq.org',
      'campushq.stacksjs.com',
    ])

    expect(orphaned).toEqual([])
  })

  it('names the domain a deploy would take down', () => {
    const orphaned = orphanedFragmentDomains(fragment, ['campushq.org', 'dashboard.campushq.org'])

    expect(orphaned).toEqual(['campushq.stacksjs.com'])
  })

  it('counts a declared apex as covering its www route', () => {
    // The gateway adds the `www` redirect itself, so no project declares it.
    // Treating it as orphaned would block every deploy that has an apex.
    const orphaned = orphanedFragmentDomains(fragment, ['campushq.org', 'dashboard.campushq.org', 'campushq.stacksjs.com'])

    expect(orphaned).not.toContain('www.campushq.org')
  })

  it('lets a retired domain through, which is the whole point', () => {
    const orphaned = orphanedFragmentDomains(
      fragment,
      ['campushq.org', 'dashboard.campushq.org'],
      ['campushq.stacksjs.com'],
    )

    expect(orphaned).toEqual([])
  })

  it('retires an apex on behalf of its www route too', () => {
    const withWww = JSON.stringify({ proxies: [{ to: 'www.oldsite.example', from: 'x' }] })

    expect(orphanedFragmentDomains(withWww, [], ['oldsite.example'])).toEqual([])
  })

  it('does not let a retired domain excuse an unrelated one', () => {
    const orphaned = orphanedFragmentDomains(
      fragment,
      ['campushq.org'],
      ['campushq.stacksjs.com'],
    )

    expect(orphaned).toEqual(['dashboard.campushq.org'])
  })

  it('reads an absent or unparsable fragment as nothing to protect', () => {
    expect(orphanedFragmentDomains('', ['campushq.org'])).toEqual([])
    expect(orphanedFragmentDomains('not json at all', ['campushq.org'])).toEqual([])
  })
})

describe('normalizeDomains', () => {
  it('trims, lowercases and drops the empties a config picks up', () => {
    expect(normalizeDomains([' CampusHQ.org ', '', null, undefined, 'WWW.Campushq.ORG']))
      .toEqual(['campushq.org', 'www.campushq.org'])
  })
})
