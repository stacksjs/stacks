import { describe, expect, test } from 'bun:test'
import { assertPublicOutboundUrl, isPrivateAddress, OutboundUrlError, outboundUrlProblem } from '../src/outbound'

describe('isPrivateAddress', () => {
  test.each([
    '127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '255.255.255.255', '198.18.0.1', '192.0.2.1',
    '::1', '::', 'fc00::1', 'fd12:3456::1', 'fe80::1', 'ff02::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '64:ff9b::a00:1', '2002:c0a8:101::1', '2001:db8::1', '[::1]', 'fe80::1%en0',
    'not-an-ip', '',
  ])('%s is private', (address) => {
    expect(isPrivateAddress(address)).toBe(true)
  })

  test.each(['1.1.1.1', '8.8.8.8', '172.32.0.1', '100.128.0.1', '2606:4700:4700::1111', '::ffff:8.8.8.8', '2002:0808:0808::1'])('%s is public', (address) => {
    expect(isPrivateAddress(address)).toBe(false)
  })
})

describe('outboundUrlProblem', () => {
  test('wants https, no credentials, and a public host', () => {
    expect(outboundUrlProblem('https://hooks.example.com/in')).toBeNull()
    expect(outboundUrlProblem('nope')?.reason).toBe('invalid')
    expect(outboundUrlProblem('http://hooks.example.com/in')?.reason).toBe('scheme')
    expect(outboundUrlProblem('ftp://hooks.example.com/in', { allowHttp: true })?.reason).toBe('scheme')
    expect(outboundUrlProblem('http://hooks.example.com/in', { allowHttp: true })).toBeNull()
    expect(outboundUrlProblem('https://user:pw@hooks.example.com/')?.reason).toBe('credentials')
    for (const url of ['https://localhost/x', 'https://127.0.0.1/', 'https://[::1]/', 'https://169.254.169.254/latest', 'https://db.internal/', 'https://printer.local/', 'https://intranet/', 'https://app.localhost/', 'https://localhost./'])
      expect(outboundUrlProblem(url)?.reason).toBe('private')
    expect(outboundUrlProblem('https://8.8.8.8/')).toBeNull()
    expect(outboundUrlProblem('http://127.0.0.1:4000/', { allowHttp: true, allowPrivate: true })).toBeNull()
  })
})

describe('assertPublicOutboundUrl', () => {
  const resolveTo = (addresses: string[]) => async () => addresses

  test('passes a name that resolves only to public addresses', async () => {
    const url = await assertPublicOutboundUrl('https://hooks.example.com/in', { resolve: resolveTo(['93.184.216.34', '2606:2800:220:1::1']) })
    expect(url.hostname).toBe('hooks.example.com')
  })

  test('refuses a name with any private address, and one that does not resolve', async () => {
    const reason = async (promise: Promise<unknown>) => {
      try {
        await promise
      }
      catch (error) {
        return error instanceof OutboundUrlError ? error.reason : 'other'
      }
      return null
    }
    expect(await reason(assertPublicOutboundUrl('https://rebind.example.com/', { resolve: resolveTo(['93.184.216.34', '10.0.0.5']) }))).toBe('private')
    expect(await reason(assertPublicOutboundUrl('https://gone.example.com/', { resolve: resolveTo([]) }))).toBe('unresolvable')
    expect(await reason(assertPublicOutboundUrl('https://gone.example.com/', { resolve: async () => { throw new Error('ENOTFOUND') } }))).toBe('unresolvable')
    expect(await reason(assertPublicOutboundUrl('http://hooks.example.com/'))).toBe('scheme')
  })

  test('allowPrivate skips the lookup for local development', async () => {
    const url = await assertPublicOutboundUrl('http://127.0.0.1:4010/hook', { allowHttp: true, allowPrivate: true, resolve: async () => { throw new Error('not called') } })
    expect(url.port).toBe('4010')
  })
})
