// The `waf` middleware, against a real socket: zig-waf needs the client's
// address and port, and only a request that came over a socket has them.
//
// The engine tests need zig-waf's shared library (ZIG_WAF_LIBRARY); the CI job
// `waf` builds it. The fail-open and fail-closed tests below run without it,
// since a WAF that cannot start is exactly what they are about.

import type { WafSecurityOptions } from '@stacksjs/types'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { resolve } from 'node:path'
import process from 'node:process'
import { HttpError } from '@stacksjs/error-handling'
import { registerPeerSource } from '@stacksjs/router'
import { inspectWithWaf } from '../../storage/framework/defaults/app/Middleware/Waf'

const library = process.env.ZIG_WAF_LIBRARY
const rules = [resolve(import.meta.dir, '../../storage/framework/core/waf/tests/fixtures/crs-sqli.conf')]
const sqli = `/search?q=${encodeURIComponent('1\' OR \'1\'=\'1')}`

let settings: WafSecurityOptions = {}
let server: ReturnType<typeof Bun.serve>

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    async fetch(req) {
      try {
        const decision = await inspectWithWaf(req, settings)
        // What the action behind the middleware would read next.
        const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : (await req.text()).length
        return Response.json({ decision, body })
      }
      catch (error) {
        if (error instanceof HttpError)
          return new Response(null, { status: error.status })
        throw error
      }
    },
  })
  registerPeerSource(server)
})
afterAll(() => server.stop(true))

const call = (path: string, init?: RequestInit) => fetch(`http://127.0.0.1:${server.port}${path}`, init)

describe.skipIf(!library)('the waf middleware, against zig-waf', () => {
  test('detection mode lets a CRS-detected SQL injection through and reports it', async () => {
    settings = { mode: 'detection', library, rules }
    const response = await call(sqli)
    expect(response.status).toBe(200)
    expect((await response.json()).decision).toEqual({ matched: true, enforced: false, status: 403, ruleId: 949110 })
  })

  test('blocking mode refuses it with the status the rule asked for', async () => {
    settings = { mode: 'blocking', library, rules }
    expect((await call(sqli)).status).toBe(403)
  })

  test('it reads the body of a form post', async () => {
    settings = { mode: 'blocking', library, rules }
    const response = await call('/login', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: `email=${encodeURIComponent('a@b.test\' OR 1=1 --')}`,
    })
    expect(response.status).toBe(403)
  })

  test('a clean request passes', async () => {
    settings = { mode: 'blocking', library, rules }
    const response = await call('/search?q=hello')
    expect(response.status).toBe(200)
    expect((await response.json()).decision).toEqual({ matched: false, enforced: false })
  })
})

describe.skipIf(!library)('the waf middleware and the request body', () => {
  test('leaves a form body for the action to read', async () => {
    settings = { mode: 'detection', library, rules }
    const form = 'email=person%40example.com&name=Pat'
    const response = await call('/contact', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form })
    expect(await response.json()).toEqual({ decision: { matched: false, enforced: false }, body: form.length })
  })

  test('leaves a multipart body for the action to read', async () => {
    settings = { mode: 'detection', library, rules }
    const data = new FormData()
    data.append('name', 'Pat')
    data.append('file', new Blob(['hello']), 'hello.txt')
    const response = await call('/upload', { method: 'POST', body: data })
    expect((await response.json()).body).toBeGreaterThan(0)
  })

  test('blocking refuses a body larger than maxBodyBytes, declared up front', async () => {
    settings = { mode: 'blocking', library, rules, maxBodyBytes: 64 }
    const response = await call('/contact', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'x'.repeat(65) })
    expect(response.status).toBe(413)
  })

  test('blocking refuses one that grows past it without declaring a length', async () => {
    settings = { mode: 'blocking', library, rules, maxBodyBytes: 64 }
    const stream = new ReadableStream({
      start(controller) {
        for (let i = 0; i < 10; i++) controller.enqueue(new TextEncoder().encode('x'.repeat(16)))
        controller.close()
      },
    })
    const response = await call('/contact', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: stream, duplex: 'half' } as RequestInit)
    expect(response.status).toBe(413)
  })

  test('detection inspects the first maxBodyBytes of a larger body and lets it through whole', async () => {
    settings = { mode: 'detection', library, rules, maxBodyBytes: 64 }
    const response = await call('/contact', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'x'.repeat(200) })
    expect(response.status).toBe(200)
    expect((await response.json()).body).toBe(200)
  })
})

describe('the waf middleware, when it cannot inspect', () => {
  test('mode off inspects nothing', async () => {
    settings = { mode: 'off' }
    expect((await (await call(sqli)).json()).decision).toBeNull()
  })

  test('a request built in-process has no socket and is not inspected', async () => {
    expect(await inspectWithWaf(new Request(`http://localhost${sqli}`), { mode: 'blocking', library, rules })).toBeNull()
  })

  test('blocking mode that cannot start refuses rather than letting everything through', async () => {
    settings = { mode: 'blocking', library: '/nowhere/libzig-waf.so', rules }
    expect((await call('/search?q=hello')).status).toBe(503)
  })

  test('detection mode that cannot start logs and lets the request through', async () => {
    settings = { mode: 'detection', library: '/nowhere/libzig-waf.so', rules }
    const response = await call('/search?q=hello')
    expect(response.status).toBe(200)
    expect((await response.json()).decision).toBeNull()
  })
})
