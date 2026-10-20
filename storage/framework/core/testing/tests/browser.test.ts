import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import process from 'node:process'
import type { PageAuditEvent } from '../src/browser'
import { auditPage, Cdp, duplicateRequests, findChrome, formatPageAudit, launch, loadDuplicates, matchesUrlPattern, navigate, pageAuditClean, pausedRequestMatches, quietLiveReload, splitPageLoads, waitFor } from '../src/browser'

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

  test('a committed frame navigation retires its old loader without hiding other work', () => {
    const { socket, cdp } = session()
    const request = (requestId: string, frameId: string, loaderId: string, url = requestId) => socket.emit({
      method: 'Network.requestWillBeSent',
      params: { requestId, frameId, loaderId, request: { method: 'GET', url: `https://hq.training/${url}` } },
    })
    socket.emit({ method: 'Page.frameNavigated', params: { frame: { id: 'main', loaderId: 'old' } } })
    // The live trace left old /m/* prefetches without either terminal event.
    request('old-prefetch', 'main', 'old', 'm/calendar')
    request('iframe', 'child', 'child-loader')
    request('worker', 'main', '')
    // The incoming document starts before its frame navigation commits.
    request('document', 'main', 'new')
    request('competing', 'main', 'another-provisional')
    expect(cdp.inFlight.size).toBe(5)
    socket.emit({ method: 'Page.frameStartedLoading', params: { frameId: 'main' } })
    expect(cdp.inFlight.has('old-prefetch')).toBe(true)
    socket.emit({ method: 'Page.frameNavigated', params: { frame: { id: 'main', loaderId: 'new' } } })
    expect([...cdp.inFlight.keys()]).toEqual(['iframe', 'worker', 'document', 'competing'])
    // Conservatively track late events until their own terminal event.
    request('late-old', 'main', 'old')
    request('current', 'main', 'new')
    expect([...cdp.inFlight.keys()]).toEqual(['iframe', 'worker', 'document', 'competing', 'late-old', 'current'])
    socket.emit({ method: 'Network.loadingFailed', params: { requestId: 'old-prefetch', canceled: true } })
    socket.emit({ method: 'Network.loadingFinished', params: { requestId: 'document' } })
    socket.emit({ method: 'Network.loadingFinished', params: { requestId: 'late-old' } })
    socket.emit({ method: 'Network.loadingFailed', params: { requestId: 'competing', canceled: true } })
    expect([...cdp.inFlight.keys()]).toEqual(['iframe', 'worker', 'current'])
    // A history restore can make a formerly retired loader current again.
    socket.emit({ method: 'Page.frameNavigated', params: { frame: { id: 'main', loaderId: 'old' } } })
    request('restored', 'main', 'old')
    expect([...cdp.inFlight.keys()]).toEqual(['iframe', 'worker', 'restored'])
    expect(cdp.errors).toEqual([])
  })

  test('a failed provisional or same-document navigation keeps the live document busy', () => {
    const { socket, cdp } = session()
    socket.emit({ method: 'Page.frameNavigated', params: { frame: { id: 'main', loaderId: 'live' } } })
    socket.emit({ method: 'Network.requestWillBeSent', params: { requestId: 'live', frameId: 'main', loaderId: 'live', request: { method: 'GET', url: 'https://hq.training/slow' } } })
    socket.emit({ method: 'Network.requestWillBeSent', params: { requestId: 'provisional', frameId: 'main', loaderId: 'incoming', request: { method: 'GET', url: 'https://hq.training/next' } } })
    socket.emit({ method: 'Network.loadingFailed', params: { requestId: 'provisional', canceled: true } })
    socket.emit({ method: 'Page.navigatedWithinDocument', params: { frameId: 'main', url: 'https://hq.training/#features' } })
    socket.emit({ method: 'Page.frameNavigated', params: { frame: { id: 'main' } } })
    expect([...cdp.inFlight.keys()]).toEqual(['live'])
    expect(cdp.errors).toEqual([])
  })

  test('redirect request reuse follows the incoming loader and a removed frame retires only its work', () => {
    const { socket, cdp } = session()
    const request = (requestId: string, frameId: string, loaderId: string) => socket.emit({
      method: 'Network.requestWillBeSent',
      params: { requestId, frameId, loaderId, request: { method: 'GET', url: 'https://hq.training/' } },
    })
    socket.emit({ method: 'Page.frameNavigated', params: { frame: { id: 'child', loaderId: 'first' } } })
    request('redirect', 'child', 'first')
    request('redirect', 'child', 'second')
    request('main', 'main', 'main-loader')
    socket.emit({ method: 'Page.frameNavigated', params: { frame: { id: 'child', parentId: 'main', loaderId: 'second' } } })
    expect([...cdp.inFlight.keys()]).toEqual(['redirect', 'main'])
    socket.emit({ method: 'Page.frameDetached', params: { frameId: 'child', reason: 'swap' } })
    expect(cdp.inFlight.has('redirect')).toBe(true)
    socket.emit({ method: 'Page.frameDetached', params: { frameId: 'child', reason: 'remove' } })
    expect([...cdp.inFlight.keys()]).toEqual(['main'])
    request('late-child', 'child', 'second')
    expect([...cdp.inFlight.keys()]).toEqual(['main', 'late-child'])
    socket.emit({ method: 'Network.loadingFailed', params: { requestId: 'late-child', canceled: true } })
    expect([...cdp.inFlight.keys()]).toEqual(['main'])
    socket.emit({ method: 'Network.loadingFailed', params: { requestId: 'main', errorText: 'net::ERR_CONNECTION_REFUSED' } })
    expect(cdp.inFlight.size).toBe(0)
    expect(cdp.errors).toEqual(['Network: net::ERR_CONNECTION_REFUSED'])
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

/** Answer every command the session sends with `{}`, so awaited sends resolve. */
function answerAll(socket: FakeSocket): void {
  const send = socket.send.bind(socket)
  socket.send = (data: string) => {
    send(data)
    const message = JSON.parse(data)
    queueMicrotask(() => socket.emit({ id: message.id, result: {} }))
  }
}

const paused = (requestId: string, url: string, extra: Record<string, unknown> = {}) =>
  ({ method: 'Fetch.requestPaused', params: { requestId, request: { url, method: 'GET', headers: {} }, resourceType: 'Fetch', ...extra } })

const sentFor = (socket: FakeSocket, method: string) => socket.sent.filter(message => message.method === method)

describe('Fetch interception', () => {
  test('matches URL patterns the way Chrome does', () => {
    expect(matchesUrlPattern('*/_stx/hmr*', 'http://localhost:3000/_stx/hmr?v=1')).toBe(true)
    expect(matchesUrlPattern('*/_stx/hmr*', 'http://localhost:3000/api/health/metrics')).toBe(false)
    expect(matchesUrlPattern('*api/*', 'http://x/api/me')).toBe(true)
    expect(matchesUrlPattern('http://x/a?c', 'http://x/abc')).toBe(true)
    expect(matchesUrlPattern('http://x/a?c', 'http://x/ac')).toBe(false)
    expect(matchesUrlPattern('*metrics\\?days=7*', 'http://x/health/metrics?days=7')).toBe(true)
    expect(matchesUrlPattern('*metrics\\?days=7*', 'http://x/health/metricsXdays=7')).toBe(false)
    expect(matchesUrlPattern('*', '')).toBe(true)
    expect(matchesUrlPattern('http://x/(a)+[b].js', 'http://x/(a)+[b].js')).toBe(true)
  })

  test('a pattern matches the stage and resource type it names', () => {
    const request = { request: { url: 'http://x/api/me', method: 'GET', headers: {} }, resourceType: 'XHR' }
    expect(pausedRequestMatches({ urlPattern: '*api*' }, request)).toBe(true)
    expect(pausedRequestMatches({ urlPattern: '*api*', requestStage: 'Response' }, request)).toBe(false)
    expect(pausedRequestMatches({ urlPattern: '*api*', requestStage: 'Response' }, { ...request, responseStatusCode: 200 })).toBe(true)
    expect(pausedRequestMatches({ urlPattern: '*api*', resourceType: 'Document' }, request)).toBe(false)
  })

  test('enables the union of every handler and the caller\'s own Fetch.enable', async () => {
    const { socket, cdp } = session()
    answerAll(socket)
    const stopQuiet = await quietLiveReload(cdp)
    expect(sentFor(socket, 'Fetch.enable').at(-1).params.patterns).toEqual([{ urlPattern: '*/_stx/hmr*' }])
    await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*api/*', requestStage: 'Request' }], handleAuthRequests: false })
    expect(sentFor(socket, 'Fetch.enable').at(-1).params).toEqual({ handleAuthRequests: false, patterns: [{ urlPattern: '*/_stx/hmr*' }, { urlPattern: '*api/*', requestStage: 'Request' }] })
    // The caller's Fetch.disable drops only its own layer.
    await cdp.send('Fetch.disable')
    expect(sentFor(socket, 'Fetch.disable')).toHaveLength(0)
    expect(sentFor(socket, 'Fetch.enable').at(-1).params.patterns).toEqual([{ urlPattern: '*/_stx/hmr*' }])
    await stopQuiet()
    expect(sentFor(socket, 'Fetch.disable')).toHaveLength(1)
  })

  test('live reload answers its own stream and leaves a journey\'s held request alone', async () => {
    const { socket, cdp } = session()
    answerAll(socket)
    await quietLiveReload(cdp)
    const seen: string[] = []
    cdp.on('Fetch.requestPaused', params => seen.push(params.request.url))
    await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*/health/metrics*' }] })
    socket.emit(paused('hmr-1', 'http://x/_stx/hmr', { resourceType: 'EventSource' }))
    socket.emit(paused('held-1', 'http://x/health/metrics?days=7'))
    await Bun.sleep(0)
    // The journey's listener never saw the stream, and the stream was the only one answered.
    expect(seen).toEqual(['http://x/health/metrics?days=7'])
    const answers = socket.sent.filter(message => message.method?.startsWith('Fetch.') && message.params?.requestId)
    expect(answers.map(message => [message.method, message.params.requestId])).toEqual([['Fetch.fulfillRequest', 'hmr-1']])
    expect(Buffer.from(answers[0].params.body, 'base64').toString()).toContain('retry: 86400000')
    // Released by the journey when it chooses.
    await cdp.send('Fetch.continueRequest', { requestId: 'held-1' })
    expect(sentFor(socket, 'Fetch.continueRequest').map(message => message.params.requestId)).toEqual(['held-1'])
  })

  test('the first answer to a paused request wins until it pauses again', async () => {
    const { socket, cdp } = session()
    answerAll(socket)
    await quietLiveReload(cdp)
    // A journey that continues everything it sees, the stream included.
    cdp.on('Fetch.requestPaused', params => void cdp.send('Fetch.continueRequest', { requestId: params.requestId }))
    await cdp.send('Fetch.enable')
    socket.emit(paused('hmr-2', 'http://x/_stx/hmr'))
    await Bun.sleep(0)
    expect(socket.sent.filter(message => message.params?.requestId === 'hmr-2').map(message => message.method)).toEqual(['Fetch.fulfillRequest'])
    // The same id pausing at its response stage takes an answer again.
    socket.emit(paused('api-1', 'http://x/api/me'))
    socket.emit(paused('api-1', 'http://x/api/me', { responseStatusCode: 200, responseHeaders: [] }))
    await Bun.sleep(0)
    expect(sentFor(socket, 'Fetch.continueRequest').filter(message => message.params.requestId === 'api-1')).toHaveLength(2)
  })

  test('intercept handlers see only their own requests, and nobody\'s request is let go', async () => {
    const { socket, cdp } = session()
    answerAll(socket)
    const slow: string[] = []
    const stop = await cdp.intercept([{ urlPattern: '*/api/slow*' }], (request) => { slow.push(request.requestId) })
    await quietLiveReload(cdp)
    socket.emit(paused('s-1', 'http://x/api/slow'))
    socket.emit(paused('h-1', 'http://x/_stx/hmr'))
    // Paused under a pattern since removed: nothing would ever answer it.
    socket.emit(paused('o-1', 'http://x/other'))
    await Bun.sleep(0)
    expect(slow).toEqual(['s-1'])
    expect(sentFor(socket, 'Fetch.continueRequest').map(message => message.params.requestId)).toEqual(['o-1'])
    await stop()
    expect(sentFor(socket, 'Fetch.enable').at(-1).params.patterns).toEqual([{ urlPattern: '*/_stx/hmr*' }])
  })

  test('a request the caller holds on purpose, with no listener, stays held', async () => {
    const { socket, cdp } = session()
    answerAll(socket)
    await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*/api/hang*' }] })
    socket.emit(paused('hang-1', 'http://x/api/hang'))
    await Bun.sleep(0)
    expect(sentFor(socket, 'Fetch.continueRequest')).toHaveLength(0)
  })

  test('a throwing or rejecting handler is recorded', async () => {
    const { socket, cdp } = session()
    answerAll(socket)
    await cdp.intercept([{ urlPattern: '*a*' }], () => { throw new Error('sync boom') })
    await cdp.intercept([{ urlPattern: '*a*' }], async () => { throw new Error('async boom') })
    socket.emit(paused('a-1', 'http://x/a'))
    await Bun.sleep(0)
    expect(cdp.errors).toEqual(['Fetch handler threw: sync boom', 'Fetch handler threw: async boom'])
    await expect(cdp.intercept([], () => {})).rejects.toThrow(TypeError)
  })

  test('inFlight is a typed map', () => {
    const { cdp } = session()
    const inFlight: Map<string, string> = cdp.inFlight
    expect(inFlight).toBeInstanceOf(Map)
  })
})

/**
 * A page for auditPage without Chrome: answers the commands it sends, and on
 * Page.navigate plays `script`, keeping `location.href` where the page went.
 */
function scriptedPage(script: (url: string) => any[]) {
  const socket = new FakeSocket()
  let href = 'about:blank'
  const send = socket.send.bind(socket)
  socket.send = (data: string) => {
    send(data)
    const message = JSON.parse(data)
    queueMicrotask(() => {
      let result: any = {}
      if (message.method === 'Page.getFrameTree') result = { frameTree: { frame: { id: 'main', url: href } } }
      if (message.method === 'Runtime.evaluate') {
        const value = message.params.expression === 'location.href' ? href : false
        result = { result: { value } }
      }
      socket.emit({ id: message.id, result })
      if (message.method === 'Page.navigate') {
        for (const event of script(message.params.url)) {
          if (event.method === 'Page.frameNavigated') href = event.params.frame.url
          if (event.method === 'Page.navigatedWithinDocument' && event.params.frameId === 'main') href = event.params.url
          socket.emit(event)
        }
      }
    })
  }
  return { socket, cdp: new Cdp(socket as unknown as WebSocket) }
}

const api = (requestId: string, url: string) => [
  { method: 'Network.requestWillBeSent', params: { requestId, request: { method: 'GET', url } } },
  { method: 'Network.loadingFinished', params: { requestId } },
]

describe('page loads', () => {
  const events: PageAuditEvent[] = [
    { type: 'navigated', url: 'http://x/today', sameDocument: false },
    { type: 'request', request: 'GET /api/me' },
    { type: 'request', request: 'GET /api/today' },
    { type: 'navigated', url: 'http://x/today?tab=2', sameDocument: true },
    { type: 'request', request: 'GET /api/today' },
    { type: 'navigated', url: 'http://x/home', sameDocument: true },
    { type: 'request', request: 'GET /api/me' },
    { type: 'request', request: 'GET /api/home' },
    { type: 'request', request: 'GET /api/home' },
  ]

  test('a client-side move to another path starts a load; a query change does not', () => {
    const loads = splitPageLoads('http://x/today', events)
    expect(loads.map(load => load.url)).toEqual(['http://x/today?tab=2', 'http://x/home'])
    expect(loads[0]!.apiRequests).toEqual(['GET /api/me', 'GET /api/today', 'GET /api/today'])
    expect(loads[0]!.duplicates).toEqual({ 'GET /api/today': 2 })
    expect(loads[1]!.duplicates).toEqual({ 'GET /api/home': 2 })
    expect(loadDuplicates(loads)).toEqual({ 'GET /api/today': 2, 'GET /api/home': 2 })
  })

  test('each new document after the first is a load, and visit mode counts it all as one', () => {
    const reload: PageAuditEvent[] = [
      { type: 'navigated', url: 'http://x/a', sameDocument: false },
      { type: 'request', request: 'GET /api/me' },
      { type: 'navigated', url: 'http://x/a', sameDocument: false },
      { type: 'request', request: 'GET /api/me' },
    ]
    expect(splitPageLoads('http://x/a', reload).map(load => load.duplicates)).toEqual([{}, {}])
    const visit = splitPageLoads('http://x/today', events, 'visit')
    expect(visit).toHaveLength(1)
    expect(visit[0]!.url).toBe('http://x/home')
    expect(visit[0]!.duplicates).toEqual({ 'GET /api/me': 2, 'GET /api/today': 2, 'GET /api/home': 2 })
  })

  test('auditPage counts duplicates per load and reports where the page landed', async () => {
    const { cdp } = scriptedPage(url => [
      { method: 'Page.frameNavigated', params: { frame: { id: 'main', url } } },
      ...api('1', 'http://x/api/me'),
      ...api('2', 'http://x/api/workspace'),
      { method: 'Page.navigatedWithinDocument', params: { frameId: 'main', url: 'http://x/home' } },
      ...api('3', 'http://x/api/me'),
      ...api('4', 'http://x/api/feed'),
      ...api('5', 'http://x/api/feed'),
      // A frame's navigation is not the page's.
      { method: 'Page.navigatedWithinDocument', params: { frameId: 'ad', url: 'http://x/elsewhere' } },
    ])
    const report = await auditPage('http://x/today', { cdp, quietMs: 0 })
    expect(report.settled).toBe(true)
    expect(report.finalUrl).toBe('http://x/home')
    expect(report.loads!.map(load => load.url)).toEqual(['http://x/today', 'http://x/home'])
    expect(report.apiRequests).toHaveLength(5)
    expect(report.duplicates).toEqual({ 'GET /api/feed': 2 })
    expect(formatPageAudit(report)).toBe('/today -> /home: 5 api | dup 2x GET /api/feed')

    const visit = await auditPage('http://x/today', { cdp, quietMs: 0, pageLoads: 'visit' })
    expect(visit.loads).toHaveLength(1)
    expect(visit.duplicates).toEqual({ 'GET /api/me': 2, 'GET /api/feed': 2 })
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
  const hits: Record<string, number> = {}
  beforeAll(() => {
    server = Bun.serve({
      port: 0,
      fetch(request) {
        const { pathname } = new URL(request.url)
        hits[pathname] = (hits[pathname] ?? 0) + 1
        if (pathname === '/api/me') return Response.json({ id: 1 })
        if (pathname === '/api/held') return Response.json({ ok: true })
        if (pathname === '/_stx/hmr') return new Response('data: reload\n\n', { headers: { 'Content-Type': 'text/event-stream' } })
        // Asks for /api/me, then moves itself on to /home the way a client router does, and asks again.
        if (pathname === '/today') return new Response(`<title>Today</title><script>
          fetch('/api/me').then(() => { history.replaceState(null, '', '/home'); return fetch('/api/me') })
        </script>`, { headers: { 'Content-Type': 'text/html' } })
        if (pathname === '/hold') return new Response(`<title>Hold</title><script>
          new EventSource('/_stx/hmr')
          fetch('/api/held').then(response => response.json()).then(value => { window.__held = value.ok })
        </script>`, { headers: { 'Content-Type': 'text/html' } })
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

  test('a page that moves itself on is two loads, and the report says where it landed', async () => {
    const report = await auditPage(`http://127.0.0.1:${server.port}/today`, { quietMs: 300 })
    expect(report.settled).toBe(true)
    expect(report.apiRequests).toEqual(['GET /api/me', 'GET /api/me'])
    expect(report.duplicates).toEqual({})
    expect(report.loads!.map(load => new URL(load.url).pathname)).toEqual(['/today', '/home'])
    expect(report.finalUrl).toBe(`http://127.0.0.1:${server.port}/home`)
    expect(formatPageAudit(report)).toStartWith('/today -> /home: 2 api')
  }, 90_000)

  test('quiet live reload leaves a journey\'s own held request to the journey', async () => {
    const { cdp, close } = await launch()
    try {
      let held: any = null
      const off = cdp.on('Fetch.requestPaused', (params) => { held = params })
      await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*/api/held*' }] })
      hits['/_stx/hmr'] = 0
      hits['/api/held'] = 0
      await cdp.send('Page.navigate', { url: `http://127.0.0.1:${server.port}/hold` })
      await waitFor(() => held, 15_000, { label: 'the held request' })
      expect(held.request.url).toContain('/api/held')
      await Bun.sleep(300)
      // Still held: not answered with an event stream, and the server has not seen it.
      expect(await cdp.evaluate('window.__held === undefined')).toBe(true)
      expect(hits['/api/held']).toBe(0)
      await cdp.send('Fetch.continueRequest', { requestId: held.requestId })
      expect(await waitFor(() => cdp.evaluate('window.__held'), 10_000)).toBe(true)
      // The live-reload stream was answered by the kit, never by the server,
      // and stays quiet after the journey turns its own interception off.
      off()
      await cdp.send('Fetch.disable')
      await navigate(cdp, `http://127.0.0.1:${server.port}/hold`, { quietMs: 300 })
      expect(await cdp.evaluate('window.__held')).toBe(true)
      expect(hits['/_stx/hmr']).toBe(0)
    }
    finally {
      await close()
    }
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
