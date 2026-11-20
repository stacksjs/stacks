import { afterAll, describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import process from 'node:process'
import { Waf } from '../src'

/**
 * Against the real engine, through bun:ffi. These need zig-waf's shared
 * library: set ZIG_WAF_LIBRARY to it (zig-out/lib/ after `zig build` in a
 * zig-waf checkout). The CI job `waf` builds it and sets it, so there these
 * run rather than skip.
 */
const library = process.env.ZIG_WAF_LIBRARY
const rules = [join(import.meta.dir, 'fixtures/crs-sqli.conf')]
const sqli = `/search?q=${encodeURIComponent('1\' OR \'1\'=\'1')}`

if (!library)
  console.warn('[waf.test] ZIG_WAF_LIBRARY is not set: the engine tests are skipped.')

describe.skipIf(!library)('the in-process WAF, against zig-waf', () => {
  const opened: Waf[] = []
  const waf = (options: ConstructorParameters<typeof Waf>[0]): Waf => {
    const instance = new Waf({ library, rules, ...options })
    opened.push(instance)
    return instance
  }
  afterAll(() => opened.forEach(instance => instance.close()))

  const connection = { clientAddress: '203.0.113.7', clientPort: 51234, serverAddress: '127.0.0.1', serverPort: 3008 }
  const get = (uri: string) => ({ ...connection, method: 'GET', uri, headers: [['host', 'app.test'], ['user-agent', 'test']] as [string, string][] })

  test('detection mode reports a CRS-detected SQL injection and refuses nothing', () => {
    const decision = waf({ mode: 'detection' }).inspect(get(sqli))
    expect(decision).toEqual({ matched: true, enforced: false, status: 403, ruleId: 949110 })
  })

  test('blocking mode refuses it', () => {
    const decision = waf({ mode: 'blocking' }).inspect(get(sqli))
    expect(decision).toEqual({ matched: true, enforced: true, status: 403, ruleId: 949110 })
  })

  test('a clean request passes in either mode', () => {
    expect(waf({ mode: 'blocking' }).inspect(get('/search?q=hello%20world'))).toEqual({ matched: false, enforced: false })
  })

  test('the body is inspected too', () => {
    const decision = waf({ mode: 'blocking' }).inspect({
      ...connection,
      method: 'POST',
      uri: '/login',
      headers: [['host', 'app.test'], ['content-type', 'application/x-www-form-urlencoded']],
      body: `email=${encodeURIComponent('a@b.test\' OR 1=1 --')}`,
    })
    expect(decision.enforced).toBeTrue()
  })

  test('a reviewed exclusion switches the rule off', () => {
    const decision = waf({ mode: 'blocking', exclusions: [{ ruleId: 942100, reason: 'test' }] }).inspect(get(sqli))
    expect(decision.matched).toBeFalse()
  })

  test('a bypassed path is not inspected', () => {
    const decision = waf({ mode: 'blocking', bypassPaths: ['/search'] }).inspect(get(sqli))
    expect(decision.matched).toBeFalse()
  })
})

describe.skipIf(!library)('a CRS checkout, laid out as CRS ships it', () => {
  const root = join(import.meta.dir, 'fixtures/crs-layout')
  const crs = [join(root, 'crs-setup.conf'), join(root, 'rules/rules.conf')]
  const opened: Waf[] = []
  afterAll(() => opened.forEach(instance => instance.close()))
  const blocking = (): Waf => {
    const instance = new Waf({ library, rules: crs, mode: 'blocking' })
    opened.push(instance)
    return instance
  }
  const request = (method: string, userAgent = 'Mozilla/5.0') => ({
    clientAddress: '203.0.113.7', clientPort: 51234, serverAddress: '127.0.0.1', serverPort: 3008,
    method, uri: '/api/posts/1', headers: [['host', 'app.test'], ['user-agent', userAgent]] as [string, string][],
  })

  test('loads, with the .data files found next to the rules rather than crs-setup.conf', () => {
    expect(blocking().inspect(request('GET', 'sqlmap/1.7')).enforced).toBeTrue()
  })

  test('lets the methods a Stacks API uses through: PUT, PATCH and DELETE', () => {
    const waf = blocking()
    for (const method of ['PUT', 'PATCH', 'DELETE'])
      expect({ method, decision: waf.inspect(request(method)) }).toEqual({ method, decision: { matched: false, enforced: false } })
  })

  test('still refuses a method outside them', () => {
    expect(blocking().inspect(request('TRACE')).enforced).toBeTrue()
  })
})
