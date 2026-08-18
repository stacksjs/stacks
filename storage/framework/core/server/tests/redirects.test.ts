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
      subtree: false,
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

/**
 * Moving a whole section to another host.
 *
 * Exact rules cannot express this: `/dashboard/events/[id]` is a real page, so
 * there is no finite list of paths to enumerate. That is the case `/section/*`
 * exists for, and the reason the original "no wildcards" rule needed exactly
 * one exception rather than none.
 */
describe('subtree redirects', () => {
  const rules = resolveRedirectRules({
    '/dashboard/*': 'https://dashboard.example.com',
  })

  test('moves the section root', () => {
    expect(resolveRedirect(at('/dashboard'), rules)?.headers.get('location'))
      .toBe('https://dashboard.example.com')
  })

  test('carries the rest of the path onto the new host', () => {
    expect(resolveRedirect(at('/dashboard/messages'), rules)?.headers.get('location'))
      .toBe('https://dashboard.example.com/messages')
  })

  test('covers a dynamic page, which is the whole point', () => {
    expect(resolveRedirect(at('/dashboard/events/42'), rules)?.headers.get('location'))
      .toBe('https://dashboard.example.com/events/42')
  })

  test('stops at a path boundary rather than a string prefix', () => {
    // `/dashboards` is a different section and must not be swallowed.
    expect(resolveRedirect(at('/dashboards'), rules)).toBeUndefined()
    expect(resolveRedirect(at('/dashboard-archive'), rules)).toBeUndefined()
  })

  test('leaves everything else alone', () => {
    expect(resolveRedirect(at('/events'), rules)).toBeUndefined()
  })

  test('keeps the query string', () => {
    expect(resolveRedirect(at('/dashboard/messages?tab=sent'), rules)?.headers.get('location'))
      .toBe('https://dashboard.example.com/messages?tab=sent')
  })

  test('an exact rule beats a subtree rule for the same URL', () => {
    const mixed = resolveRedirectRules({
      '/dashboard/*': 'https://dashboard.example.com',
      '/dashboard/legacy': '/archive',
    })

    expect(resolveRedirect(at('/dashboard/legacy'), mixed)?.headers.get('location')).toBe('/archive')
    expect(resolveRedirect(at('/dashboard/other'), mixed)?.headers.get('location'))
      .toBe('https://dashboard.example.com/other')
  })

  test('the longest matching prefix wins, whatever the declaration order', () => {
    // So a section can be carved out of a broader rule without the table
    // depending on the order someone happened to write it in.
    const nested = resolveRedirectRules({
      '/dashboard/*': 'https://dashboard.example.com',
      '/dashboard/reports/*': 'https://reports.example.com',
    })

    expect(resolveRedirect(at('/dashboard/reports/q4'), nested)?.headers.get('location'))
      .toBe('https://reports.example.com/q4')
  })

  test('still refuses to touch the API', () => {
    const api = resolveRedirectRules({ '/api/*': 'https://elsewhere.example.com' })
    expect(resolveRedirect(at('/api/campushq/messages'), api)).toBeUndefined()
  })

  test('does not double the slash when the target has a trailing one', () => {
    const trailing = resolveRedirectRules({ '/dashboard/*': 'https://dashboard.example.com/' })
    expect(resolveRedirect(at('/dashboard/messages'), trailing)?.headers.get('location'))
      .toBe('https://dashboard.example.com/messages')
  })
})
