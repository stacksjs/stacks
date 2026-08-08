/**
 * Declarative redirects for the views server.
 *
 * A Stacks app replacing an older site had nowhere to say "this URL moved".
 * `config/server.ts` could forward a path to the API, and a page could redirect
 * from `definePageMeta`, but that needs a real page to exist at the old URL —
 * which means committing a stub `.stx` per legacy path purely to throw the
 * request away again.
 *
 * These cover the rules the resolver has to get right: the normalising that
 * makes a table readable, the two footguns it refuses (redirecting `/api/**`,
 * and a rule that points at itself), and the query-string handling that decides
 * whether an inbound campaign keeps its attribution across the hop.
 */

import { describe, expect, test } from 'bun:test'
import {
  DEFAULT_REDIRECT_STATUS,
  describeRedirectRules,
  resolveRedirect,
  resolveRedirectRules,
} from '../src/redirects'

const at = (path: string) => new URL(`http://localhost${path}`)

describe('resolveRedirectRules', () => {
  test('accepts the shorthand string form', () => {
    const rules = resolveRedirectRules({ '/old': '/new' })

    expect(rules.get('/old')).toEqual({
      from: '/old',
      to: '/new',
      status: DEFAULT_REDIRECT_STATUS,
      preserveQuery: true,
    })
  })

  test('defaults to a permanent redirect', () => {
    expect(DEFAULT_REDIRECT_STATUS).toBe(301)
    expect(resolveRedirectRules({ '/old': '/new' }).get('/old')?.status).toBe(301)
  })

  test('honours an explicit status and preserveQuery', () => {
    const rules = resolveRedirectRules({
      '/sale': { to: '/specials', status: 302, preserveQuery: false },
    })

    expect(rules.get('/sale')).toMatchObject({ status: 302, preserveQuery: false })
  })

  test('treats a trailing slash as insignificant', () => {
    const rules = resolveRedirectRules({ '/our-story/': '/story' })

    expect(rules.has('/our-story')).toBe(true)
    expect(resolveRedirect(at('/our-story/'), rules)?.status).toBe(301)
    expect(resolveRedirect(at('/our-story'), rules)?.status).toBe(301)
  })

  test('drops a rule that would loop', () => {
    // `/a` -> `/a` and `/a` -> `/a/` are the same destination once normalised,
    // and the browser is what finds out otherwise.
    expect(resolveRedirectRules({ '/a': '/a' }).size).toBe(0)
    expect(resolveRedirectRules({ '/a': '/a/' }).size).toBe(0)
    expect(resolveRedirectRules({ '/a/': '/a' }).size).toBe(0)
  })

  test('leaves an absolute target alone even when the path matches', () => {
    // Not a loop: a different host that happens to share the path.
    const rules = resolveRedirectRules({ '/docs': 'https://docs.example.com/docs' })

    expect(rules.get('/docs')?.to).toBe('https://docs.example.com/docs')
  })

  test('refuses to redirect the API', () => {
    const rules = resolveRedirectRules({
      '/api/old': '/api/new',
      '/api': '/',
      '/page': '/other',
    })

    expect(rules.has('/api/old')).toBe(false)
    expect(rules.has('/api')).toBe(false)
    expect(rules.has('/page')).toBe(true)
  })

  test('drops malformed entries rather than throwing', () => {
    const rules = resolveRedirectRules({
      'no-leading-slash': '/somewhere',
      '/empty-target': '',
      '/good': '/fine',
    })

    expect(rules.size).toBe(1)
    expect(rules.has('/good')).toBe(true)
  })

  test('is empty for no configuration', () => {
    expect(resolveRedirectRules().size).toBe(0)
    expect(resolveRedirectRules({}).size).toBe(0)
  })
})

describe('resolveRedirect', () => {
  const rules = resolveRedirectRules({
    '/old': '/new',
    '/temp': { to: '/new', status: 302 },
    '/bare': { to: '/new', preserveQuery: false },
    '/tagged': '/new?ref=legacy',
  })

  test('answers a matched path with a Location header', () => {
    const res = resolveRedirect(at('/old'), rules)

    expect(res?.status).toBe(301)
    expect(res?.headers.get('Location')).toBe('/new')
  })

  test('carries the query string over by default', () => {
    // A redirect that drops `?utm_source=…` loses the attribution for the very
    // visit it just forwarded.
    expect(resolveRedirect(at('/old?utm_source=news'), rules)?.headers.get('Location'))
      .toBe('/new?utm_source=news')
  })

  test('merges with a query string the target already carries', () => {
    expect(resolveRedirect(at('/tagged?utm_source=news'), rules)?.headers.get('Location'))
      .toBe('/new?ref=legacy&utm_source=news')
  })

  test('drops the query string when told to', () => {
    expect(resolveRedirect(at('/bare?utm_source=news'), rules)?.headers.get('Location'))
      .toBe('/new')
  })

  test('caches a permanent redirect and not a temporary one', () => {
    expect(resolveRedirect(at('/old'), rules)?.headers.get('Cache-Control')).toBe('public, max-age=3600')
    expect(resolveRedirect(at('/temp'), rules)?.headers.get('Cache-Control')).toBe('no-store')
  })

  test('carries on routing for an unmatched path', () => {
    expect(resolveRedirect(at('/menu'), rules)).toBeUndefined()
    expect(resolveRedirect(at('/'), rules)).toBeUndefined()
  })

  test('carries on routing when nothing is configured', () => {
    expect(resolveRedirect(at('/old'))).toBeUndefined()
    expect(resolveRedirect(at('/old'), resolveRedirectRules({}))).toBeUndefined()
  })
})

describe('describeRedirectRules', () => {
  test('says so when there are none', () => {
    expect(describeRedirectRules(resolveRedirectRules({}))).toBe('none')
  })

  test('lists a short table in full', () => {
    expect(describeRedirectRules(resolveRedirectRules({ '/a': '/b', '/c': '/d' })))
      .toBe('/a → /b, /c → /d')
  })

  test('truncates a long one, because boot output nobody reads is noise', () => {
    const many = Object.fromEntries(
      Array.from({ length: 6 }, (_, i) => [`/old-${i}`, `/new-${i}`]),
    )

    expect(describeRedirectRules(resolveRedirectRules(many)))
      .toBe('/old-0 → /new-0, /old-1 → /new-1, /old-2 → /new-2 (+3 more)')
  })
})
