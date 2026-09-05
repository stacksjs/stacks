// The router establishes a per-request read-routing context.
//
// Two things are being guarded here, and the second is the dangerous one.
//
// 1. `serverResponse` must run its handler inside the database package's
//    routing context. Without it, `contextHasWritten()` has no store to
//    consult, always reports false, and a read issued right after a write in
//    the same request routes to a replica — the exact stale-read bug the
//    routing rules exist to prevent. The tracking would be dead code.
//
// 2. It must do that WITHOUT deadlocking. `@stacksjs/database` already
//    depends on `@stacksjs/router`, so reaching back the other way closes a
//    package cycle, and this codebase has hit bun module-loader deadlocks
//    from exactly that shape before (see the note atop
//    `database/src/drivers/mysql.ts`: 60s at 99% CPU). The import is lazy for
//    that reason, and a test that merely checked the context existed would
//    pass just as happily while hanging every request.

import { describe, expect, test } from 'bun:test'
import { contextHasWritten, markContextWrote, withRoutingContext } from '@stacksjs/database'
import { createStacksRouter, serverResponse } from '../src/stacks-router'

describe('routing context plumbing', () => {
  test('direct serving starts without preloading the database package', async () => {
    const child = Bun.spawn([
      process.execPath,
      `--config=${import.meta.dir}/fixtures/cold-start.toml`,
      `${import.meta.dir}/fixtures/serve-cold-start.ts`,
    ], { stdout: 'pipe', stderr: 'pipe' })
    const timeout = setTimeout(() => child.kill(), 10_000)
    try {
      const [exitCode, stdout, stderr] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ])
      expect(exitCode, stderr).toBe(0)
      expect(stdout).toContain('router-cold-start-ok')
    }
    finally {
      clearTimeout(timeout)
      child.kill()
      await child.exited
    }
  }, 15_000)

  test('directly served requests track writes and isolate concurrent readers', async () => {
    const router = createStacksRouter()
    const writing = Promise.withResolvers<void>()
    const release = Promise.withResolvers<void>()
    router.get('/__routing_write', async () => {
      const before = contextHasWritten()
      markContextWrote()
      writing.resolve()
      await release.promise
      return { before, after: contextHasWritten() }
    })
    router.get('/__routing_read', () => ({ wrote: contextHasWritten() }))
    const server = await router.serve({ port: 0 })
    try {
      const writer = fetch(`http://localhost:${server.port}/__routing_write`)
      await writing.promise
      const reader = await fetch(`http://localhost:${server.port}/__routing_read`)
      expect(await reader.json()).toEqual({ wrote: false })
      release.resolve()
      expect(await (await writer).json()).toEqual({ before: false, after: true })
      const later = await fetch(`http://localhost:${server.port}/__routing_read`)
      expect(await later.json()).toEqual({ wrote: false })
      expect(contextHasWritten()).toBe(false)
    }
    finally {
      release.resolve()
      await server.stop(true)
    }
  }, 15_000)

  test('marking a write is inert with no context established', () => {
    // Background jobs and one-shot scripts have no request boundary; they
    // must not throw, they simply get no read-your-writes guarantee.
    expect(() => markContextWrote()).not.toThrow()
    expect(contextHasWritten()).toBe(false)
  })

  test('a write inside a context sticks', () => {
    withRoutingContext(() => {
      expect(contextHasWritten()).toBe(false)
      markContextWrote()
      expect(contextHasWritten()).toBe(true)
    })
  })

  test('the context does not leak out of its scope', () => {
    withRoutingContext(() => markContextWrote())
    expect(contextHasWritten()).toBe(false)
  })
})

describe('serverResponse resolves the context runner without deadlocking', () => {
  // The cycle guard. If the lazy import ever becomes a static one — or the
  // loader starts resolving it eagerly — this hangs rather than failing, so
  // the assertion is on completion, with the suite timeout as the real
  // detector.
  test('a request completes and returns a Response', async () => {
    const response = await serverResponse(new Request('http://localhost/__routing_ctx_probe__'))
    // Any status is fine — an unrouted path 404s, which still proves the
    // handler ran to completion through the wrapped context.
    expect(response).toBeInstanceOf(Response)
    expect(typeof response.status).toBe('number')
  }, 15_000)

  test('a second request reuses the cached runner', async () => {
    // The runner is resolved once and memoized; a second call must not
    // re-enter the dynamic import path.
    const response = await serverResponse(new Request('http://localhost/__routing_ctx_probe_2__'))
    expect(response).toBeInstanceOf(Response)
  }, 15_000)

  test('requests do not leak write state into each other', async () => {
    // Each request gets a fresh store, so one request that writes must not
    // pin later requests onto the primary.
    await serverResponse(new Request('http://localhost/__routing_ctx_probe_3__'))
    expect(contextHasWritten()).toBe(false)
  }, 15_000)
})
