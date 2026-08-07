/**
 * stacksjs/stacks#2230 — in the split views/API topology, `isApiBoundRequest`
 * decided what reached the API process with a fixed rule: the `/api/**` prefix,
 * or a mutating verb. A plain `GET` route declared at the root on the API
 * process was therefore unreachable, and the reporting app had to design public
 * URLs around it — `/health` became `/api/health`, `/me` became `/api/me`, and
 * the OAuth redirect and callback (URLs that live in a provider's console)
 * moved under `/api/auth/{provider}/*`.
 *
 * The issue's first ask was to make the predicate route-aware via
 * `route.getAllowedMethods(pathname)`. That is not reachable from here:
 * `isApiBoundRequest` runs inside the VIEWS process and the route table is
 * registered in the API process — a separate process under `buddy dev` and
 * potentially a separate host under `buddy serve`. So this implements the
 * issue's second ask, an explicit app-owned list, plus the third: the effective
 * rules are printable so a 404 on a route you know exists is diagnosable.
 */

import { describe, expect, test } from 'bun:test'
import {
  DEFAULT_API_METHODS,
  DEFAULT_API_PREFIX,
  describeApiProxyRules,
  isApiBoundRequest,
  resolveApiProxyRules,
} from '../src/proxy'

const get = (path: string) => new Request(`http://localhost${path}`)
const post = (path: string) => new Request(`http://localhost${path}`, { method: 'POST' })

describe('resolveApiProxyRules', () => {
  test('always forwards /api/, even with no configuration', () => {
    expect(resolveApiProxyRules().prefixes).toEqual([DEFAULT_API_PREFIX])
  })

  test('keeps /api/ when an app configures its own prefixes', () => {
    // Dropping it would make the framework's own auto-CRUD routes unreachable
    // with no indication why, so configuring prefixes ADDS to it.
    expect(resolveApiProxyRules({ prefixes: ['/oauth/'] }).prefixes)
      .toEqual([DEFAULT_API_PREFIX, '/oauth/'])
  })

  test('defaults methods to the mutating verbs', () => {
    expect([...resolveApiProxyRules().methods].sort()).toEqual([...DEFAULT_API_METHODS].sort())
  })

  test('normalises a prefix to a trailing slash', () => {
    expect(resolveApiProxyRules({ prefixes: ['/oauth'] }).prefixes).toEqual([DEFAULT_API_PREFIX, '/oauth/'])
  })

  test('normalises a trailing slash off an exact path', () => {
    expect(resolveApiProxyRules({ paths: ['/health/'] }).paths).toEqual(['/health'])
  })

  test('keeps the root path intact', () => {
    expect(resolveApiProxyRules({ paths: ['/'] }).paths).toEqual(['/'])
  })

  test('uppercases configured methods', () => {
    expect([...resolveApiProxyRules({ methods: ['get'] }).methods]).toEqual(['GET'])
  })

  test('ignores entries that are not rooted paths', () => {
    // A bare 'health' would silently never match; dropping it is the same
    // outcome, but it keeps the resolved rules honest for the boot print.
    const rules = resolveApiProxyRules({ paths: ['health', '', '  '], prefixes: ['oauth'] })
    expect(rules.paths).toEqual([])
    expect(rules.prefixes).toEqual([DEFAULT_API_PREFIX])
  })

  test('de-duplicates', () => {
    const rules = resolveApiProxyRules({ paths: ['/health', '/health/'], prefixes: ['/api/', '/api'] })
    expect(rules.paths).toEqual(['/health'])
    expect(rules.prefixes).toEqual([DEFAULT_API_PREFIX])
  })
})

describe('isApiBoundRequest without rules', () => {
  test('is exactly the old fixed policy', () => {
    // Both call sites pass rules now, but the parameter is optional and the
    // no-argument behaviour is what every existing caller and test expects.
    expect(isApiBoundRequest(get('/api/users'), '/api/users')).toBe(true)
    expect(isApiBoundRequest(post('/subscribe'), '/subscribe')).toBe(true)
    expect(isApiBoundRequest(get('/health'), '/health')).toBe(false)
    expect(isApiBoundRequest(get('/apifoo'), '/apifoo')).toBe(false)
  })
})

describe('isApiBoundRequest with rules', () => {
  test('an unconfigured app behaves exactly as before', () => {
    const rules = resolveApiProxyRules()
    expect(isApiBoundRequest(get('/api/users'), '/api/users', rules)).toBe(true)
    expect(isApiBoundRequest(post('/subscribe'), '/subscribe', rules)).toBe(true)
    expect(isApiBoundRequest(get('/health'), '/health', rules)).toBe(false)
    expect(isApiBoundRequest(get('/'), '/', rules)).toBe(false)
  })

  test('forwards the exact paths from the report', () => {
    const rules = resolveApiProxyRules({ paths: ['/health', '/me'] })
    expect(isApiBoundRequest(get('/health'), '/health', rules)).toBe(true)
    expect(isApiBoundRequest(get('/me'), '/me', rules)).toBe(true)
    // Still a page render, so still not forwarded.
    expect(isApiBoundRequest(get('/about'), '/about', rules)).toBe(false)
  })

  test('an exact path does not match a deeper path', () => {
    const rules = resolveApiProxyRules({ paths: ['/health'] })
    expect(isApiBoundRequest(get('/health/db'), '/health/db', rules)).toBe(false)
  })

  test('a prefix forwards the subtree and the bare path', () => {
    // `/oauth` itself has to work: the OAuth *redirect* in the report is a
    // browser-facing URL and it would be strange for the parent to 404 while
    // its children proxy.
    const rules = resolveApiProxyRules({ prefixes: ['/oauth/'] })
    expect(isApiBoundRequest(get('/oauth/github/callback'), '/oauth/github/callback', rules)).toBe(true)
    expect(isApiBoundRequest(get('/oauth'), '/oauth', rules)).toBe(true)
  })

  test('a prefix does not match a longer sibling name', () => {
    // The reason prefixes are normalised to a trailing slash: `/admin` must
    // not swallow `/administrators`.
    const rules = resolveApiProxyRules({ prefixes: ['/admin'] })
    expect(isApiBoundRequest(get('/administrators'), '/administrators', rules)).toBe(false)
    expect(isApiBoundRequest(get('/admin/users'), '/admin/users', rules)).toBe(true)
  })

  test('configured methods replace the defaults rather than adding to them', () => {
    const rules = resolveApiProxyRules({ methods: ['POST'] })
    expect(isApiBoundRequest(post('/subscribe'), '/subscribe', rules)).toBe(true)
    expect(isApiBoundRequest(new Request('http://localhost/x', { method: 'DELETE' }), '/x', rules)).toBe(false)
  })

  test('an app can forward GET everywhere if it really wants to', () => {
    const rules = resolveApiProxyRules({ methods: ['GET'] })
    expect(isApiBoundRequest(get('/anything'), '/anything', rules)).toBe(true)
  })
})

describe('describeApiProxyRules', () => {
  test('names the defaults', () => {
    expect(describeApiProxyRules(resolveApiProxyRules()))
      .toBe('prefixes /api/, methods DELETE/PATCH/POST/PUT')
  })

  test('includes configured paths', () => {
    expect(describeApiProxyRules(resolveApiProxyRules({ paths: ['/health'], prefixes: ['/oauth/'] })))
      .toBe('prefixes /api/ /oauth/, methods DELETE/PATCH/POST/PUT, paths /health')
  })
})
