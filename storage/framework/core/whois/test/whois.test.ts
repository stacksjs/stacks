import { describe, expect, it } from 'bun:test'
import { findWhoIsServer, getParameters, getTLD, getWhoIsServer } from '../src/index'

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

describe('findWhoIsServer', () => {
  it('should find whois server from IANA', async () => {
    // This makes a real network request to IANA
    const server = await findWhoIsServer('com')
    expect(typeof server).toBe('string')
  }, { timeout: 10000 })

  it('should handle invalid TLD', async () => {
    const server = await findWhoIsServer('invalid-tld-12345')
    expect(server).toBe('')
  }, { timeout: 10000 })
})
