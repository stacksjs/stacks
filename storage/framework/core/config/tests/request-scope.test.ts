// `requestContext` reads the scope of the request a script runs inside.
//
// Both view servers used to answer it from process-wide globals, so a script
// that read it after an `await`, or from a layout, got whichever request had
// most recently started rendering. These pin the pieces: a scope entered in
// the synchronous prefix of an `onRequest`-shaped hook reaches everything the
// caller does after awaiting it, a scope entered after an `await` reaches
// nothing, and stx's `__stxServeContext` mirror answers per request.
// core/buddy/tests/request-context-concurrency.test.ts runs the servers.

import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { createRequestContext, enterRequestScope, scopedRequestSnapshot, scopeStxServeContext } from '../src/request-context'

const pause = () => new Promise<void>(resolve => setTimeout(resolve, Math.random() * 3))

type Hook = (req: Request) => Promise<void>

/**
 * A server that calls `hook` the way stx serve calls `onRequest` (awaited,
 * from the request's own async context) and then reads `requestContext`
 * twice more after further awaits, as a page and then its layout would.
 */
async function serveThrough(hook: Hook): Promise<{ url: string, stop: () => void }> {
  const requestContext = createRequestContext(scopedRequestSnapshot)
  const server = Bun.serve({
    port: 0,
    async fetch(req) {
      await hook(req)
      await pause()
      const page = requestContext.cookie('who')
      await pause()
      const layout = requestContext.cookie('who')
      return Response.json({ page, layout })
    },
  })

  return { url: `http://127.0.0.1:${server.port}`, stop: () => server.stop(true) }
}

/** Every response's reads, for `count` requests with distinct cookies. */
async function hammer(url: string, count: number): Promise<{ own: number, none: number, foreign: number }> {
  const tally = { own: 0, none: 0, foreign: 0 }
  await Promise.all(Array.from({ length: count }, async (_, index) => {
    const who = `visitor-${index}`
    const body = await (await fetch(url, { headers: { cookie: `who=${who}` } })).json() as { page: string | null, layout: string | null }
    for (const seen of [body.page, body.layout]) {
      if (seen === who)
        tally.own++
      else if (seen === null)
        tally.none++
      else
        tally.foreign++
    }
  }))
  return tally
}

describe('a request scope', () => {
  it('is empty outside any request', () => {
    expect(scopedRequestSnapshot()).toBeUndefined()
  })

  it('reaches every later read of its own request when entered before the hook awaits', async () => {
    const server = await serveThrough(async (req) => {
      enterRequestScope(req)
      await pause()
    })
    try {
      expect(await hammer(server.url, 200)).toEqual({ own: 400, none: 0, foreign: 0 })
    }
    finally {
      server.stop()
    }
  })

  it('reaches nothing when entered after the hook awaits', async () => {
    // The shape both servers had. It is why "AsyncLocalStorage does not
    // survive into stx-serve's render" was written down: the placement, not
    // the mechanism.
    const server = await serveThrough(async (req) => {
      await pause()
      enterRequestScope(req)
    })
    try {
      expect(await hammer(server.url, 200)).toEqual({ own: 0, none: 400, foreign: 0 })
    }
    finally {
      server.stop()
    }
  })

  it('is not inherited by a request that entered none', async () => {
    // Half the requests skip the scope. Theirs must read nothing, never the
    // scope of a request that happened to be in flight beside them.
    const server = await serveThrough(async (req) => {
      if (Number(new URL(req.url).searchParams.get('n')) % 2 === 0)
        enterRequestScope(req)
      await pause()
    })
    try {
      const reads = await Promise.all(Array.from({ length: 200 }, async (_, index) => {
        const body = await (await fetch(`${server.url}/?n=${index}`, { headers: { cookie: `who=visitor-${index}` } })).json() as { page: string | null, layout: string | null }
        return { index, ...body }
      }))
      const entered = reads.filter(read => read.index % 2 === 0)
      const skipped = reads.filter(read => read.index % 2 === 1)
      expect(entered.every(read => read.page === `visitor-${read.index}` && read.layout === `visitor-${read.index}`)).toBe(true)
      expect(skipped.every(read => read.page === null && read.layout === null)).toBe(true)
    }
    finally {
      server.stop()
    }
  })

  it('carries what the server resolves later in the hook', async () => {
    const requestContext = createRequestContext(scopedRequestSnapshot)
    const server = Bun.serve({
      port: 0,
      async fetch(req) {
        const snapshot = enterRequestScope(req)
        await pause()
        snapshot.site = { id: Number(new URL(req.url).searchParams.get('site')) }
        await pause()
        return Response.json({ site: requestContext.site()?.id ?? null })
      },
    })
    try {
      const sites = await Promise.all(Array.from({ length: 50 }, async (_, index) => {
        const body = await (await fetch(`http://127.0.0.1:${server.port}/?site=${index}`)).json() as { site: number | null }
        return body.site
      }))
      expect(sites).toEqual(Array.from({ length: 50 }, (_, index) => index))
    }
    finally {
      server.stop(true)
    }
  })
})

describe('stx\'s __stxServeContext mirror', () => {
  const scope = globalThis as { __stxServeContext?: unknown }
  let previous: PropertyDescriptor | undefined

  beforeAll(() => {
    previous = Object.getOwnPropertyDescriptor(globalThis, '__stxServeContext')
    scopeStxServeContext()
  })

  afterAll(() => {
    delete scope.__stxServeContext
    if (previous)
      Object.defineProperty(globalThis, '__stxServeContext', previous)
  })

  it('answers each request with what stx assigned during that request', async () => {
    // stx assigns the global once per render, before the page's scripts; a
    // plain global then holds the latest render's for every reader.
    const requestContext = createRequestContext(scopedRequestSnapshot)
    const server = Bun.serve({
      port: 0,
      async fetch(req) {
        enterRequestScope(req)
        await pause()
        const id = new URL(req.url).searchParams.get('id')!
        scope.__stxServeContext = { params: { id }, ip: `ip-${id}` }
        await pause()
        return Response.json({ params: requestContext.params(), ip: requestContext.ip() })
      },
    })
    try {
      const answers = await Promise.all(Array.from({ length: 50 }, async (_, index) => {
        return await (await fetch(`http://127.0.0.1:${server.port}/?id=${index}`)).json()
      }))
      expect(answers).toEqual(Array.from({ length: 50 }, (_, index) => ({ params: { id: String(index) }, ip: `ip-${index}` })))
    }
    finally {
      server.stop(true)
    }
  })

  it('prefers what stx published and keeps the server\'s site', async () => {
    const server = Bun.serve({
      port: 0,
      async fetch(req) {
        const snapshot = enterRequestScope(req)
        snapshot.site = { id: 7 }
        scope.__stxServeContext = { cookies: { minted: 'yes' }, locale: null }
        return Response.json(scopedRequestSnapshot())
      },
    })
    try {
      const snapshot = await (await fetch(`http://127.0.0.1:${server.port}/a?b=1`, { headers: { cookie: 'raw=1' } })).json() as Record<string, unknown>
      expect(snapshot.cookies).toEqual({ minted: 'yes' })
      expect(snapshot.locale).toBeNull()
      expect(snapshot.site).toEqual({ id: 7 })
      expect(snapshot.path).toBe('/a')
      expect(snapshot.search).toBe('?b=1')
    }
    finally {
      server.stop(true)
    }
  })

  it('keeps an assignment made outside any request for readers outside one', () => {
    scope.__stxServeContext = { url: 'prewarm' }
    expect(scope.__stxServeContext).toEqual({ url: 'prewarm' })
    // And requestContext still reports no request there.
    expect(scopedRequestSnapshot()).toBeUndefined()
  })
})
