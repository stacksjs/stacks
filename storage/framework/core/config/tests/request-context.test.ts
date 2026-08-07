// One request object for `<script server>` blocks (stacksjs/stacks#2232).
//
// `requestContext` was installed twice — dev and production — with two
// backings, two sets of methods, and no shared type. Both installers were
// `(globalThis as any)`, so nothing could catch a divergence, and two shipped:
// production's `url()` returned only the query string (so `new URL(...)` threw
// on the box), and production had no `locale()` at all.
//
// A shared type would only have made those detectable. A shared factory makes
// them impossible, so these tests exercise the factory both servers now call
// and then assert that neither still builds its own.

import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRequestContext, parseCookieHeader, useRequestEvent } from '../src/request-context'

const FULL = {
  cookies: { session: 'abc', theme: 'dark' },
  url: 'https://example.com/dashboard?range=30d&site=7',
  path: '/dashboard',
  search: '?range=30d&site=7',
  locale: 'de',
  params: { id: '7' },
  ip: '203.0.113.9',
  host: 'example.com',
}

describe('reading a request (#2232)', () => {
  const ctx = createRequestContext(() => FULL)

  it('returns the full url, not the query string', () => {
    // The exact production incident: `new URL(requestContext.url())` worked in
    // dev and threw on the box.
    expect(ctx.url()).toBe(FULL.url)
    expect(() => new URL(ctx.url())).not.toThrow()
  })

  it('exposes locale', () => {
    // The other incident: "requestContext.locale is not a function".
    expect(ctx.locale()).toBe('de')
  })

  it('reads one cookie and all of them', () => {
    expect(ctx.cookie('session')).toBe('abc')
    expect(ctx.cookie('absent')).toBeNull()
    expect(ctx.cookies()).toEqual(FULL.cookies)
  })

  it('parses the query', () => {
    expect(ctx.query()).toEqual({ range: '30d', site: '7' })
  })

  it('exposes path, params, ip and host', () => {
    expect(ctx.path()).toBe('/dashboard')
    expect(ctx.params()).toEqual({ id: '7' })
    expect(ctx.ip()).toBe('203.0.113.9')
    expect(ctx.host()).toBe('example.com')
  })
})

describe('an older or partial snapshot still answers (#2232)', () => {
  it('derives search from url when the snapshot has only url', () => {
    // An stx that predates the richer snapshot carries `url` alone.
    const ctx = createRequestContext(() => ({ url: 'https://example.com/a?x=1' }))
    expect(ctx.search()).toBe('?x=1')
    expect(ctx.query()).toEqual({ x: '1' })
  })

  it('derives path from url', () => {
    const ctx = createRequestContext(() => ({ url: 'https://example.com/a/b?x=1' }))
    expect(ctx.path()).toBe('/a/b')
  })

  it('derives path from a relative url too', () => {
    // `new URL` throws on a relative url; falling back to the substring keeps
    // this from taking down the render.
    const ctx = createRequestContext(() => ({ url: '/a/b?x=1' }))
    expect(ctx.path()).toBe('/a/b')
  })
})

describe('no request in flight (#2232)', () => {
  // Ask 3's spirit: shaped and empty rather than absent, so a page never needs
  // `typeof requestContext !== 'undefined'`.
  const ctx = createRequestContext(() => undefined)

  it('answers with empty values instead of throwing', () => {
    expect(ctx.url()).toBe('')
    expect(ctx.path()).toBe('')
    expect(ctx.search()).toBe('')
    expect(ctx.query()).toEqual({})
    expect(ctx.cookies()).toEqual({})
    expect(ctx.cookie('session')).toBeNull()
    expect(ctx.params()).toEqual({})
    expect(ctx.ip()).toBe('')
    expect(ctx.host()).toBe('')
  })

  it('falls back to en, not to the framework default locale', () => {
    // What a page sees when the request carried no locale at all. Guessing a
    // non-English one would be worse than saying so.
    expect(ctx.locale()).toBe('en')
  })
})

describe('the snapshot is read per access (#2232)', () => {
  it('does not pin the first request onto later ones', () => {
    // Capturing the snapshot once would serve request A's cookies to request B
    // — the failure mode that matters most, since cookies carry who is signed in.
    let current: any = { cookies: { session: 'first' } }
    const ctx = createRequestContext(() => current)

    expect(ctx.cookie('session')).toBe('first')
    current = { cookies: { session: 'second' } }
    expect(ctx.cookie('session')).toBe('second')
  })
})

describe('cookie parsing (#2232)', () => {
  it('parses a header', () => {
    expect(parseCookieHeader('a=1; b=two')).toEqual({ a: '1', b: 'two' })
  })

  it('decodes percent-escapes', () => {
    expect(parseCookieHeader('redirect=%2Fdashboard')).toEqual({ redirect: '/dashboard' })
  })

  it('keeps a malformed escape rather than dropping the cookie', () => {
    // The sender's problem, not a reason to lose the value.
    expect(parseCookieHeader('token=%E0%A4%A')).toEqual({ token: '%E0%A4%A' })
  })

  it('handles an absent or empty header', () => {
    expect(parseCookieHeader(null)).toEqual({})
    expect(parseCookieHeader('')).toEqual({})
  })

  it('skips malformed pairs', () => {
    expect(parseCookieHeader('novalue; =orphan; a=1')).toEqual({ a: '1' })
  })
})

describe('the single accessor (#2232 ask 4)', () => {
  it('returns a shaped object with no request in flight', () => {
    const previous = (globalThis as any).requestContext
    delete (globalThis as any).requestContext
    try {
      const event = useRequestEvent()
      expect(event.query).toEqual({})
      expect(event.locale).toBe('en')
      expect(event.url).toBe('')
    }
    finally {
      if (previous !== undefined)
        (globalThis as any).requestContext = previous
    }
  })

  it('reads the installed context when there is one', () => {
    const previous = (globalThis as any).requestContext
    ;(globalThis as any).requestContext = createRequestContext(() => FULL)
    try {
      expect(useRequestEvent().query).toEqual({ range: '30d', site: '7' })
      expect(useRequestEvent().locale).toBe('de')
    }
    finally {
      if (previous === undefined)
        delete (globalThis as any).requestContext
      else
        (globalThis as any).requestContext = previous
    }
  })
})

describe('both servers go through the factory (#2232 ask 1)', () => {
  const dev = readFileSync(join(import.meta.dir, '../../actions/src/dev/views.ts'), 'utf8')
  const prod = readFileSync(join(import.meta.dir, '../../buddy/src/production-server.ts'), 'utf8')

  it('each installs via the shared factory', () => {
    expect(dev).toContain('installRequestContext(')
    expect(prod).toContain('installRequestContext(')
  })

  it('neither hand-assigns the global any more', () => {
    // `(globalThis as any).requestContext = { ... }` in either file is how the
    // two shapes drifted in the first place.
    expect(dev).not.toContain('(globalThis as any).requestContext')
    expect(prod).not.toContain('(globalThis as any).requestContext')
  })

  it('neither carries its own cookie parser', () => {
    expect(dev).not.toContain('header.split(\';\')')
    expect(prod).not.toContain('header.split(\';\')')
  })
})
