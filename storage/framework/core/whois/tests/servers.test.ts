import { describe, expect, it } from 'bun:test'
import { findWhoIsServer, getParameters, getTLD, getWhoIsServer } from '../src/index'

/**
 * `findWhoIsServer` asks IANA over HTTPS, so its cases run only under
 * `WHOIS_LIVE=1`, like the live lookups in whois.test.ts. The rest read the
 * bundled server list and need no network.
 */
const live = process.env.WHOIS_LIVE === '1'

describe('getTLD', () => {
  it('should extract TLD from domain', () => {
    expect(getTLD('example.com')).toBe('com')
    expect(getTLD('example.co.uk')).toBe('uk') // co.uk not in SERVERS list
    expect(getTLD('test.org')).toBe('org')
  })

  it('should handle single part domains', () => {
    expect(getTLD('localhost')).toBe('localhost')
  })
})

describe('getWhoIsServer', () => {
  it('should return whois server for com', () => {
    expect(getWhoIsServer('com')).toBe('whois.verisign-grs.com')
  })

  it('should return whois server for org', () => {
    const server = getWhoIsServer('org')
    expect(server).toBeDefined()
    expect(typeof server).toBe('string')
  })

  it('should return undefined for unknown TLD', () => {
    const server = getWhoIsServer('nonexistent-tld-12345' as any)
    expect(server).toBeUndefined()
  })
})

describe('getParameters', () => {
  it('should return parameters for known servers', () => {
    const params = getParameters('whois.verisign-grs.com')
    // Parameters may or may not exist, just check it doesn't throw
    expect(params === undefined || typeof params === 'string').toBe(true)
  })
})

describe.skipIf(!live)('findWhoIsServer (live network)', () => {
  it('should find whois server from IANA', async () => {
    // This makes a real network request to IANA. A failed request answers
    // '', which is a string too, so the case pins the server IANA names.
    const server = await findWhoIsServer('com')
    expect(server).toBe('whois.verisign-grs.com')
  }, { timeout: 10000 })

  it('should handle invalid TLD', async () => {
    // A failed request answers '' as well. The case above is the one that
    // fails when IANA cannot be reached.
    const server = await findWhoIsServer('invalid-tld-12345')
    expect(server).toBe('')
  }, { timeout: 10000 })
})
