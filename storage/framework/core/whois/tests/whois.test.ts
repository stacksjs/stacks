import { describe, expect, it } from 'bun:test'
import { findWhoIsServer, getTLD, getWhoIsServer, lookup, whois } from '../src'

describe('@stacksjs/whois', () => {
  it('should get correct TLD', () => {
    expect(getTLD('example.com')).toBe('com')
    expect(getTLD('test.co.uk')).toBe('co.uk')
  })

  it('should get correct WhoIs server', () => {
    expect(getWhoIsServer('com')).toBe('whois.verisign-grs.com')
    expect(getWhoIsServer('net')).toBe('whois.verisign-grs.com')
  })

  it('should find WhoIs server from IANA', async () => {
    const server = await findWhoIsServer('app')
    expect(server).toBe('whois.nic.google')
  })

  it('should perform whois lookup', async () => {
    try {
      const result = await whois('example.com')
      // console.log('Raw WHOIS result:', result._raw)
      expect(result._raw).toContain('Domain Name: EXAMPLE.COM')
      expect(result.parsedData).toBeNull() // because parse is false by default
    }
    catch (error) {
      console.error('WHOIS lookup error:', error)
      throw error
    }
  })

  it('should perform parsed whois lookup', async () => {
    try {
      const result = await lookup('example.com')
      // console.log('Parsed WHOIS result:', result)
      expect(result._raw).toContain('Domain Name: EXAMPLE.COM')
      expect(result.parsedData).toHaveProperty('Domain Name', 'EXAMPLE.COM')
    }
    catch (error) {
      console.error('Parsed WHOIS lookup error:', error)
      throw error
    }
  })
})
