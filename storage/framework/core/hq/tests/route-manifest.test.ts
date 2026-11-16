import { describe, expect, test } from 'bun:test'
import { buildRouteManifest, statusMatches, summarizeRouteManifest } from '../src/route-manifest'

const check = (routes: Parameters<typeof buildRouteManifest>[0], pages: string[] = []) => buildRouteManifest(routes, pages)

describe('what a route is asked', () => {
  test('a GET route must answer, or refuse for want of credentials', () => {
    const { checks } = check([{ method: 'get', path: '/api/status', name: 'status' }])
    expect(checks).toEqual([{ id: 'GET /api/status', method: 'GET', path: '/api/status', kind: 'public', expect: ['2xx', '3xx', '401', '403'], name: 'status' }])
    // Gone or broken is what fails it.
    expect(statusMatches(checks[0]!.expect, 404)).toBe(false)
    expect(statusMatches(checks[0]!.expect, 500)).toBe(false)
  })

  test('a route behind auth is asked without credentials, and must refuse', () => {
    const { checks } = check([
      { method: 'GET', path: '/api/me', middleware: ['auth'] },
      { method: 'DELETE', path: '/api/account', middleware: ['throttle', 'can:delete-account'] },
    ])
    expect(checks.find(c => c.path === '/api/me')).toMatchObject({ kind: 'guard', expect: ['401', '403', '3xx'] })
    expect(checks.find(c => c.path === '/api/me')).not.toHaveProperty('send')
    expect(checks.find(c => c.path === '/api/account')).toMatchObject({ kind: 'guard', send: 'empty-json', expect: ['401', '403', '419', '3xx'] })
  })

  test('a validated write is sent an empty body it must refuse', () => {
    const { checks } = check([{ method: 'POST', path: '/api/login', validation: 'required' }])
    expect(checks[0]).toMatchObject({ kind: 'validation', send: 'empty-json' })
    expect(checks[0]!.expect).toContain('422')
    // Never a success: an accepted empty body would have run the handler.
    expect(statusMatches(checks[0]!.expect, 200)).toBe(false)
    expect(statusMatches(checks[0]!.expect, 201)).toBe(false)
  })

  test('pages are asked for, and a route at the same address wins', () => {
    const { checks } = check([{ method: 'GET', path: '/pricing', middleware: ['auth'] }], ['/', 'pricing', '/blog/{slug}'])
    expect(checks.map(c => `${c.kind} ${c.id}`)).toEqual(['page GET /', 'guard GET /pricing'])
  })
})

describe('what is left alone, and why', () => {
  const reasons = (routes: Parameters<typeof buildRouteManifest>[0]) => Object.fromEntries(check(routes).skipped.map(s => [`${s.method} ${s.path}`, s.reason]))

  test('nothing that could change data is ever asked', () => {
    const manifest = check([
      { method: 'POST', path: '/api/things' },
      { method: 'POST', path: '/api/search', validation: 'optional' },
      { method: 'DELETE', path: '/api/things/clear' },
      { method: 'PUT', path: '/api/settings' },
    ])
    expect(manifest.checks).toEqual([])
    expect(manifest.skipped.map(s => s.reason)).toEqual([
      'an empty body would be accepted, so asking would run it',
      'writes without validating, so asking would run it',
      'writes without validating, so asking would run it',
      'writes without validating, so asking would run it',
    ])
  })

  test('parameters, webhooks, framework routes and repeat-unsafe paths', () => {
    expect(reasons([
      { method: 'GET', path: '/api/posts/{id}' },
      { method: 'POST', path: '/api/webhooks/stripe', validation: 'required' },
      { method: 'GET', path: '/__openapi.json' },
      { method: 'GET', path: '/api/auth/logout' },
      { method: 'GET', path: '/api/live/stream' },
      { method: 'GET', path: '/api/old', monitor: false },
    ])).toEqual({
      'GET /api/posts/{id}': 'has path parameters, and no .monitor({ path }) to fill them in',
      'POST /api/webhooks/stripe': 'a webhook, which only its sender can sign',
      'GET /__openapi.json': 'a framework route, not the app\'s own',
      'GET /api/auth/logout': 'not safe to request over and over',
      'GET /api/live/stream': 'not safe to request over and over',
      'GET /api/old': 'opted out with .monitor(false)',
    })
  })

  test('HEAD and OPTIONS are not routes of their own', () => {
    expect(check([{ method: 'OPTIONS', path: '/api/x' }, { method: 'HEAD', path: '/api/x' }])).toEqual({ version: 1, checks: [], skipped: [] })
  })
})

describe('a route\'s own word', () => {
  test('a path fills in parameters, and the check keeps the path it asks for', () => {
    const { checks } = check([{ method: 'GET', path: '/api/posts/{id}', monitor: { path: '/api/posts/1' } }])
    expect(checks).toEqual([{ id: 'GET /api/posts/1', method: 'GET', path: '/api/posts/1', kind: 'public', expect: ['2xx', '3xx', '401', '403'] }])
  })

  test('expect replaces what was worked out, and only real statuses count', () => {
    const { checks } = check([{ method: 'GET', path: '/api/beta', monitor: { expect: [404, '4XX', 'nope', 99] } }])
    expect(checks[0]!.expect).toEqual(['404', '4xx'])
  })

  test('expect can bring back a GET that was left out, never a write', () => {
    const manifest = check([
      { method: 'GET', path: '/api/auth/logout', monitor: { expect: [302] } },
      { method: 'POST', path: '/api/things', monitor: { expect: [200] } },
    ])
    expect(manifest.checks.map(c => c.id)).toEqual(['GET /api/auth/logout'])
    expect(manifest.skipped.map(s => s.path)).toEqual(['/api/things'])
  })
})

describe('the manifest as a whole', () => {
  test('is in one order whatever order the routes came in', () => {
    const routes = [
      { method: 'POST', path: '/api/b', validation: 'required' as const },
      { method: 'GET', path: '/api/b' },
      { method: 'GET', path: '/api/a' },
    ]
    expect(check(routes)).toEqual(check([...routes].reverse()))
    expect(check(routes).checks.map(c => c.id)).toEqual(['GET /api/a', 'GET /api/b', 'POST /api/b'])
  })

  test('counts by kind', () => {
    const manifest = check([{ method: 'GET', path: '/api/a' }, { method: 'GET', path: '/api/me', middleware: ['auth'] }, { method: 'POST', path: '/api/x' }], ['/'])
    expect(summarizeRouteManifest(manifest)).toEqual({ total: 3, page: 1, public: 1, guard: 1, validation: 0, skipped: 1 })
  })

  test('a status matches a class or an exact code', () => {
    expect(statusMatches(['2xx', '3xx'], 204)).toBe(true)
    expect(statusMatches(['2xx', '3xx'], 404)).toBe(false)
    expect(statusMatches(['401', '403'], 403)).toBe(true)
    expect(statusMatches(['401', '403'], 400)).toBe(false)
  })
})
