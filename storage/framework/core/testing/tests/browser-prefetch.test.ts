import { describe, expect, test } from 'bun:test'
import process from 'node:process'
import { auditPage, Cdp, findChrome, launch, pageAuditClean, settle, waitFor } from '../src/browser'

class Socket extends EventTarget {
  send() {}
  emit(method: string, params: unknown) {
    const event = new Event('message') as Event & { data: string }
    event.data = JSON.stringify({ method, params })
    this.dispatchEvent(event)
  }
}

test('request-purpose observation retains raw work, ordinary requests and failures', () => {
  const socket = new Socket()
  const cdp = new Cdp(socket as unknown as WebSocket)
  const request = (id: string, headers: Record<string, string> = {}, type = 'Fetch') => socket.emit('Network.requestWillBeSent', {
    requestId: id, type, request: { method: 'GET', url: `http://localhost/work?id=${id}`, headers },
  })
  request('ordinary')
  request('purpose', { Purpose: 'prefetch' })
  request('secure-purpose', { 'sec-purpose': 'prefetch;prerender' })
  request('browser-prefetch', {}, 'Prefetch')
  request('not-prefetch', { Purpose: 'not-prefetch' })
  request('preload', { Purpose: 'preload' })
  expect(cdp.inFlight.size).toBe(6)
  expect([...cdp.foregroundInFlight.keys()]).toEqual(['ordinary', 'not-prefetch', 'preload'])

  // A redirect can reuse an id with another purpose; do not retain the old classification.
  request('purpose')
  expect(cdp.foregroundInFlight.has('purpose')).toBe(true)
  socket.emit('Network.loadingFailed', { requestId: 'secure-purpose', errorText: 'connection failed', canceled: false })
  expect(cdp.errors).toContain('Network: connection failed')
  expect(cdp.inFlight.has('secure-purpose')).toBe(false)
  for (const id of [...cdp.inFlight.keys()]) socket.emit('Network.loadingFinished', { requestId: id })
  expect(cdp.inFlight.size).toBe(0)
  expect(cdp.foregroundInFlight.size).toBe(0)
})

const realChrome = Boolean(findChrome()) && (process.env.CI ? process.env.STACKS_BROWSER_TESTS === '1' : process.env.STACKS_BROWSER_TESTS !== '0')
describe.skipIf(!realChrome)('request purpose in real Chrome', () => {
  async function fixture(run: (origin: string, release: (kind: string) => void) => Promise<void>) {
    const held = new Map<string, () => void>()
    const server = Bun.serve({
      hostname: '127.0.0.1',
      port: 0,
      async fetch(request) {
        const url = new URL(request.url)
        if (url.pathname === '/api/work') {
          await new Promise<void>(resolve => held.set(url.searchParams.get('kind')!, resolve))
          return Response.json({ ok: true })
        }
        if (url.pathname === '/api/fail') return new Response('Expected failure', { status: 503, headers: { 'Cache-Control': 'no-store' } })
        if (url.pathname === '/held') return new Response(`<html><body>Current page<script>
          fetch('/api/work?kind=prefetch', {headers:{Purpose:'prefetch'}});
          fetch('/api/work?kind=current');
        </script></body></html>`, { headers: { 'Content-Type': 'text/html' } })
        if (url.pathname === '/failure') return new Response(`<html><body>Current page<script>
          fetch('/api/work?kind=current');
          (async()=>{await fetch('/api/fail',{headers:{Purpose:'prefetch'}});await fetch('/api/fail',{headers:{Purpose:'prefetch'}});console.error('speculative audit probe')})();
        </script></body></html>`, { headers: { 'Content-Type': 'text/html' } })
        return new Response(null, { status: 204 })
      },
    })
    try { await run(`http://127.0.0.1:${server.port}`, kind => { held.get(kind)?.(); held.delete(kind) }) }
    finally {
      for (const release of held.values()) release()
      server.stop(true)
    }
  }

  test('opted-in readiness waits for ordinary work while a declared prefetch stays observable', async () => {
    await fixture(async (origin, release) => {
      const { cdp, close } = await launch({ shared: false })
      try {
        await cdp.send('Page.navigate', { url: `${origin}/held` })
        await waitFor(() => [...cdp.inFlight.values()].filter(value => value.includes('/api/work')).length === 2)
        expect(await settle(cdp, { includeSpeculative: false, quietMs: 50, timeoutMs: 200 })).toBe(false)
        release('current')
        expect(await settle(cdp, { includeSpeculative: false, quietMs: 50, timeoutMs: 2000 })).toBe(true)
        expect([...cdp.inFlight.values()]).toEqual([`GET ${origin}/api/work?kind=prefetch`])
        expect(cdp.foregroundInFlight.size).toBe(0)
        // The existing default still observes the whole finite network.
        expect(await settle(cdp, { quietMs: 50, timeoutMs: 200 })).toBe(false)
        release('prefetch')
        expect(await settle(cdp, { quietMs: 50, timeoutMs: 2000 })).toBe(true)
      }
      finally { release('current'); release('prefetch'); await close() }
    })
  }, 90_000)

  test('speculative failures, duplicate API requests and console errors still fail audit', async () => {
    await fixture(async (origin, release) => {
      const { cdp, close } = await launch({ shared: false })
      try {
        const auditing = auditPage(`${origin}/failure`, { cdp, includeSpeculative: false, quietMs: 50, timeoutMs: 5000 })
        await waitFor(() => cdp.errors.some(error => error.includes('speculative audit probe')))
        release('current')
        const report = await auditing
        expect(report.settled).toBe(true)
        expect(report.failed).toContain('503 /api/fail')
        expect(report.duplicates['GET /api/fail']).toBe(2)
        expect(report.errors.some(error => error.includes('speculative audit probe'))).toBe(true)
        expect(pageAuditClean(report)).toBe(false)
      }
      finally { release('current'); await close() }
    })
  }, 90_000)
})
