import { describe, expect, it } from 'bun:test'
import { parseIanaWhoisServer, WhoIsParser } from '../src'

/**
 * The parser read a record a character at a time and dropped every colon, so
 * every timestamp and URL came back damaged; and the IANA lookup answered
 * "status:" for a TLD with no whois server.
 */
const verisign = [
  '   Domain Name: EXAMPLE.COM',
  '   Registrar URL: http://res-dom.iana.org',
  '   Updated Date: 2024-08-14T07:01:34Z',
  '   Creation Date: 1995-08-14T04:00:00Z',
  '   Registry Expiry Date: 2025-08-13T04:00:00Z',
  '   Registrar: RESERVED-Internet Assigned Numbers Authority',
  '   Domain Status: clientDeleteProhibited https://icann.org/epp#clientDeleteProhibited',
  '   Domain Status: clientTransferProhibited https://icann.org/epp#clientTransferProhibited',
  '>>> Last update of whois database: 2024-10-01T12:00:00Z <<<',
  'Domain Name: AFTER-THE-MARKER.COM',
].join('\n')

describe('WhoIsParser.parseData', () => {
  it('keeps the colons in a value, so dates parse and URLs work', () => {
    const parsed = WhoIsParser.parseData(verisign, null)
    expect(parsed['Creation Date']).toBe('1995-08-14T04:00:00Z')
    expect(parsed['Updated Date']).toBe('2024-08-14T07:01:34Z')
    expect(new Date(parsed['Registry Expiry Date']).toISOString()).toBe('2025-08-13T04:00:00.000Z')
    expect(parsed['Domain Status']).toEqual([
      'clientDeleteProhibited https://icann.org/epp#clientDeleteProhibited',
      'clientTransferProhibited https://icann.org/epp#clientTransferProhibited',
    ])
  })

  it('stops at the >>> line', () => {
    expect(WhoIsParser.parseData(verisign, null)['Domain Name']).toBe('EXAMPLE.COM')
  })

  it('reads a value printed on the line after its field', () => {
    const nominet = '    Registrar:\n        Tucows Inc [Tag = TUCOWS]\n        URL: https://tucows.com\n\n    Relevant dates:\n        Registered on: 26-Aug-2020\n'
    expect(WhoIsParser.parseData(nominet, { 'Registrar': '', 'Registered on': '' })).toEqual({
      'Registrar': 'Tucows Inc [Tag = TUCOWS]',
      'Registered on': '26-Aug-2020',
    })
  })
})

describe('parseIanaWhoisServer', () => {
  it('finds nothing on an empty whois line, instead of the next field', () => {
    // IANA's record for .dev, which publishes RDAP only, as served.
    const dev = 'ds-rdata:     60074 8 2 b942e2ce5aebf62fca59d05707e6dbb795211d540d8adba02e9e89e833424785\n\nwhois:        \n\nstatus:       ACTIVE\nremarks:      Registration information: https://www.registry.google\n'
    expect(parseIanaWhoisServer(dev)).toBe('')
    expect(parseIanaWhoisServer('whois:\t\twhois.nic.io\nstatus: ACTIVE\n')).toBe('whois.nic.io')
  })
})
