import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import process from 'node:process'
import { auditPage, Cdp, duplicateRequests, findChrome, formatPageAudit, launch, navigate, pageAuditClean, waitFor } from '../src/browser'

/** A socket double: records what the session sends and lets the test speak for Chrome. */
class FakeSocket extends EventTarget {
  sent: any[] = []
  send(data: string) { this.sent.push(JSON.parse(data)) }
  close() { this.dispatchEvent(new Event('close')) }
  emit(message: unknown) {
    const event = new Event('message') as Event & { data: string }
    event.data = JSON.stringify(message)
    this.dispatchEvent(event)
  }
}

const session = (options = {}) => {
  const socket = new FakeSocket()
  return { socket, cdp: new Cdp(socket as unknown as WebSocket, options) }
}

describe('Cdp', () => {
  test('calls every listener for a method, and each can be removed', () => {
    const { socket, cdp } = session()
    const seen: string[] = []
    const offFirst = cdp.on('Page.loadEventFired', () => seen.push('first'))
    cdp.on('Page.loadEventFired', () => seen.push('second'))
    socket.emit({ method: 'Page.loadEventFired', params: {} })
    expect(seen).toEqual(['first', 'second'])
    offFirst()
    socket.emit({ method: 'Page.loadEventFired', params: {} })
    expect(seen).toEqual(['first', 'second', 'second'])
  })

  test('a throwing listener is recorded and does not stop the others', () => {
    const { socket, cdp } = session()
    let reached = false
    cdp.on('Page.frameNavigated', () => { throw new Error('bad listener') })
    cdp.on('Page.frameNavigated', () => { reached = true })
    socket.emit({ method: 'Page.frameNavigated', params: {} })
    expect(reached).toBe(true)
    expect(cdp.errors[0]).toContain('bad listener')
  })

  test('resolves and rejects commands by id', async () => {
    const { socket, cdp } = session()
    const ok = cdp.send('Runtime.evaluate', { expression: '1' })
    const bad = cdp.send('Page.navigate', { url: 'x' })
    expect(socket.sent.map(message => message.method)).toEqual(['Runtime.evaluate', 'Page.navigate'])
    socket.emit({ id: socket.sent[0].id, result: { result: { value: 1 } } })
    socket.emit({ id: socket.sent[1].id, error: { message: 'Invalid URL' } })
    expect(await ok).toEqual({ result: { value: 1 } })
    await expect(bad).rejects.toThrow('Invalid URL')
  })

  test('times out a command that never answers', async () => {
    const { cdp } = session({ commandTimeoutMs: 50 })
    await expect(cdp.send('Page.navigate')).rejects.toThrow(/timed out: Page.navigate/)
  })

  test('fails everything pending when Chrome goes away', async () => {
    const { socket, cdp } = session()
    const pending = cdp.send('Page.navigate')
    const waiting = cdp.once('Page.loadEventFired')
    socket.close()
    await expect(pending).rejects.toThrow(/closed/)
    await expect(waiting).rejects.toThrow(/closed/)
    expect(cdp.closed).toBe(true)
    await expect(cdp.send('Page.enable')).rejects.toThrow(/closed/)
  })

  test('once waits for a matching event', async () => {
    const { socket, cdp } = session()
    const next = cdp.once<{ frameId: string }>('Page.frameStoppedLoading', params => params.frameId === 'b')
    socket.emit({ method: 'Page.frameStoppedLoading', params: { frameId: 'a' } })
    socket.emit({ method: 'Page.frameStoppedLoading', params: { frameId: 'b' } })
    expect((await next).frameId).toBe('b')
  })

  test('tracks requests in flight, and lets event streams go', () => {
    const { socket, cdp } = session()
    socket.emit({ method: 'Network.requestWillBeSent', params: { requestId: '1', request: { method: 'GET', url: 'http://x/api/me' } } })
    socket.emit({ method: 'Network.requestWillBeSent', params: { requestId: '2', request: { method: 'GET', url: 'http://x/api/events' } } })
    expect([...cdp.inFlight.values()]).toEqual(['GET http://x/api/me', 'GET http://x/api/events'])
    socket.emit({ method: 'Network.responseReceived', params: { requestId: '2', response: { mimeType: 'text/event-stream' } } })
    socket.emit({ method: 'Network.loadingFinished', params: { requestId: '1' } })
    expect(cdp.inFlight.size).toBe(0)
  })

  test('collects page errors', () => {
    const { socket, cdp } = session()
    socket.emit({ method: 'Runtime.exceptionThrown', params: { exceptionDetails: { exception: { description: 'TypeError: x is undefined' } } } })
    socket.emit({ method: 'Runtime.consoleAPICalled', params: { type: 'error', args: [{ value: 'Failed' }, { value: 'to load' }] } })
    socket.emit({ method: 'Runtime.consoleAPICalled', params: { type: 'log', args: [{ value: 'fine' }] } })
    socket.emit({ method: 'Log.entryAdded', params: { entry: { level: 'error', text: 'favicon.ico 404' } } })
    socket.emit({ method: 'Network.loadingFailed', params: { requestId: '9', errorText: 'net::ERR_ABORTED', canceled: true } })
    socket.emit({ method: 'Network.loadingFailed', params: { requestId: '9', errorText: 'net::ERR_CONNECTION_REFUSED' } })
    expect(cdp.errors).toEqual(['TypeError: x is undefined', 'Failed to load', 'Network: net::ERR_CONNECTION_REFUSED'])
  })
})

describe('helpers', () => {
  test('waitFor returns the first truthy value, or times out with a label', async () => {
    let n = 0
    expect(await waitFor(() => ++n >= 3 && n, 1000, { intervalMs: 5 })).toBe(3)
    await expect(waitFor(() => false, 30, { label: 'nothing' })).rejects.toThrow(/waiting for nothing/)
  })

  test('duplicateRequests and the report line', () => {
    expect(duplicateRequests(['GET /api/a', 'GET /api/b', 'GET /api/a', 'GET /api/a'])).toEqual({ 'GET /api/a': 3 })
    const report = { url: 'http://x/home?tab=1', apiRequests: ['GET /api/a', 'GET /api/a'], duplicates: { 'GET /api/a': 2 }, failed: ['404 /api/b'], errors: ['boom'], settled: true, durationMs: 5 }
    expect(formatPageAudit(report)).toBe('/home?tab=1: 2 api | dup 2x GET /api/a | failed 404 /api/b | errors boom')
    expect(pageAuditClean(report)).toBe(false)
    expect(pageAuditClean({ ...report, duplicates: {}, failed: [], errors: [] })).toBe(true)
  })
})

// A real Chrome, where one is installed. On macOS the first run clones and
// re-signs it into the temp directory (a few seconds); later runs reuse it.
// CI runs it only when asked (STACKS_BROWSER_TESTS=1): a runner's Chrome, if it
// has one, is not something this package controls.
const realChrome = Boolean(findChrome()) && (process.env.CI ? process.env.STACKS_BROWSER_TESTS === '1' : process.env.STACKS_BROWSER_TESTS !== '0')
describe.skipIf(!realChrome)('a real Chrome', () => {
  let server: ReturnType<typeof Bun.serve>
  beforeAll(() => {
    server = Bun.serve({
      port: 0,
      fetch(request) {
        const { pathname } = new URL(request.url)
        if (pathname === '/api/me') return Response.json({ id: 1 })
        if (pathname === '/api/missing') return new Response('nope', { status: 404 })
        if (pathname === '/clean') return new Response('<title>Clean</title><script>fetch("/api/me")</script>', { headers: { 'Content-Type': 'text/html' } })
        if (pathname === '/dialog') return new Response('<script>confirm("Leave?")</script>', { headers: { 'Content-Type': 'text/html' } })
        return new Response(`<title>Busy</title><script>
          fetch('/api/me'); fetch('/api/me'); fetch('/api/missing');
          console.error('something broke')
        </script>`, { headers: { 'Content-Type': 'text/html' } })
      },
    })
  })
  afterAll(() => server?.stop(true))

  test('audits a page: duplicates, failures and console errors', async () => {
    const report = await auditPage(`http://127.0.0.1:${server.port}/busy`, { quietMs: 300 })
    expect(report.settled).toBe(true)
    expect(report.duplicates).toEqual({ 'GET /api/me': 2 })
    expect(report.failed).toEqual(['404 /api/missing'])
    expect(report.errors.some(error => error.includes('something broke'))).toBe(true)
  }, 90_000)

  test('a clean page is clean, and a dialog is answered and reported', async () => {
    const { cdp, close } = await launch()
    try {
      const clean = await auditPage(`http://127.0.0.1:${server.port}/clean`, { cdp, quietMs: 300 })
      expect(pageAuditClean(clean)).toBe(true)
      expect(await cdp.evaluate('document.title')).toBe('Clean')
      expect(await cdp.evaluate('navigator.userAgent')).not.toContain('HeadlessChrome')
      await navigate(cdp, `http://127.0.0.1:${server.port}/dialog`, { quietMs: 300 })
      expect(cdp.errors.some(error => error.startsWith('Dialog (confirm)'))).toBe(true)
    }
    finally {
      await close()
    }
  }, 90_000)
})
