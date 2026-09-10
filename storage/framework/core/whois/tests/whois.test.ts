import { describe, expect, it } from 'bun:test'
import { findWhoIsServer, getTLD, getWhoIsServer, lookup, parseIanaWhoisServer, whois } from '../src'

/**
 * Three of the tests in this file talk to the public internet - IANA over
 * HTTPS, and Verisign over whois port 43. They are integration tests, and they
 * were failing this repository's CI whenever one of those services was slow,
 * with `Expected: > 0` as the whole explanation. A red build that says nothing
 * about the diff is worse than no build.
 *
 * They are still worth having, so they are opt-in rather than deleted:
 * `WHOIS_LIVE=1 bun test` runs them. What CI checks instead is the parsing,
 * which is where the logic lives and which needs no network at all.
 */
const live = process.env.WHOIS_LIVE === '1'

describe('@stacksjs/whois', () => {
  it('should get correct TLD', () => {
    expect(getTLD('example.com')).toBe('com')
    expect(getTLD('test.co.uk')).toBe('uk') // co.uk not in SERVERS, returns uk
  })

  it('should get correct WhoIs server', () => {
    expect(getWhoIsServer('com')).toBe('whois.verisign-grs.com')
    expect(getWhoIsServer('net')).toBe('whois.verisign-grs.com')
  })
})

describe('parseIanaWhoisServer', () => {
  /** A real IANA record, trimmed to the shape the parser has to read. */
  const record = [
    '% IANA WHOIS server',
    '',
    'domain:       APP',
    '',
    'organisation: Charleston Road Registry Inc.',
    '',
    'whois:        whois.nic.google',
    '',
    'status:       ACTIVE',
    '',
  ].join('\n')

  it('reads the whois field out of a record', () => {
    expect(parseIanaWhoisServer(record)).toBe('whois.nic.google')
  })

  it('answers empty for a record that names no server', () => {
    // A real case: some ccTLDs have no whois service. The caller cannot tell
    // this from a network failure, which is a separate wart, but both are
    // legitimately "no server".
    expect(parseIanaWhoisServer('domain:       EXAMPLE\nstatus:       ACTIVE\n')).toBe('')
    expect(parseIanaWhoisServer('')).toBe('')
  })

  it('only matches the field, not the word in prose', () => {
    // The pattern is anchored to the start of a line for this reason: an
    // unanchored match took the first `whois:` anywhere in the text, which in
    // some records is inside a sentence.
    const prose = [
      '% For more information on the whois: protocol, see the notes below.',
      'whois:        whois.nic.example',
    ].join('\n')

    expect(parseIanaWhoisServer(prose)).toBe('whois.nic.example')
  })

  it('stops at the first whitespace, so a trailing comment is not part of the host', () => {
    expect(parseIanaWhoisServer('whois:        whois.nic.google   # primary\n')).toBe('whois.nic.google')
  })
})

describe.skipIf(!live)('@stacksjs/whois (live network)', () => {
  it('should find WhoIs server from IANA', async () => {
    const server = await findWhoIsServer('app')
    // IANA response format may vary, just check we got a server
    expect(typeof server).toBe('string')
    expect(server.length).toBeGreaterThan(0)
  })

  it('should perform whois lookup', async () => {
    const result = await whois('example.com')
    expect(result._raw).toContain('Domain Name: EXAMPLE.COM')
    // parse parameter defaults to false in whois() but parser still runs
    expect(result.parsedData).toBeDefined()
  })

  it('should perform parsed whois lookup', async () => {
    const result = await lookup('example.com')
    expect(result._raw).toContain('Domain Name: EXAMPLE.COM')
    expect(result.parsedData).toHaveProperty('Domain Name', 'EXAMPLE.COM')
  })
})
