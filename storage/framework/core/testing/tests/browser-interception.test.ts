import { describe, expect, test } from 'bun:test'
import type { ServerWebSocket } from 'bun'
import process from 'node:process'
import { connect, findChrome, launch, waitFor } from '../src/browser'

interface ProtocolCommand {
  id: number
  method: string
  params: Record<string, unknown>
}

/** An owned protocol endpoint: the public client sees real WebSocket ordering. */
async function protocol(run: (cdp: Awaited<ReturnType<typeof connect>>, provider: {
  emit: (method: string, params: unknown) => void
  commands: ProtocolCommand[]
  reply: (command: ProtocolCommand) => { error?: { code: number, message: string } }
}) => Promise<void>) {
  let socket!: ServerWebSocket<undefined>
  const provider = {
    commands: [] as ProtocolCommand[],
    emit: (method: string, params: unknown) => { socket.send(JSON.stringify({ method, params })) },
    reply: (command: ProtocolCommand) => ({ error: command.method.startsWith('Fetch.') && command.params.requestId
      ? { code: -32602, message: 'Invalid InterceptionId.' }
      : undefined }),
  }
  const server = Bun.serve({
    hostname: '127.0.0.1', port: 0,
    fetch: (request, server) => server.upgrade(request) ? undefined : new Response(null, { status: 400 }),
    websocket: {
      open(peer: ServerWebSocket<undefined>) { socket = peer },
      message(peer, data) {
        const command = JSON.parse(String(data))
        provider.commands.push(command)
        const { error } = provider.reply(command)
        peer.send(JSON.stringify({ id: command.id, result: error ? undefined : {}, error }))
      },
    },
  })
  let cdp: Awaited<ReturnType<typeof connect>> | undefined
  try {
    cdp = await connect(`ws://127.0.0.1:${server.port}`)
    await run(cdp, provider)
  }
  finally {
    cdp?.disconnect()
    server.stop(true)
  }
}

const pause = (requestId: string, networkId?: string) => ({
  requestId, networkId, resourceType: 'Fetch',
  request: { url: 'http://localhost/api/work', method: 'GET', headers: {} },
})

test('a network cancellation retires only its own paused interception', async () => {
  await protocol(async (cdp, provider) => {
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    const done: string[] = []
    await cdp.intercept([{ urlPattern: '*' }], async (request, session) => {
      await gate
      await session.send('Fetch.continueRequest', { requestId: request.requestId })
      done.push(request.requestId)
    })
    provider.emit('Fetch.requestPaused', pause('cancelled', 'network-cancelled'))
    provider.emit('Fetch.requestPaused', pause('live', 'network-live'))
    provider.emit('Network.loadingFailed', { requestId: 'network-cancelled', canceled: true, errorText: 'net::ERR_ABORTED' })
    await cdp.send('Runtime.enable')
    release()
    await waitFor(() => done.length + cdp.errors.length === 2)
    expect(provider.commands.filter(command => command.method === 'Fetch.continueRequest').map(command => command.params.requestId)).toEqual(['live'])
    expect(cdp.errors).toEqual(['Fetch handler threw: Invalid InterceptionId.'])
    expect(done).toEqual(['cancelled'])
  })
})

test('cancellation before the pause still prevents an answer, without hiding handler failures', async () => {
  await protocol(async (cdp, provider) => {
    const done: string[] = []
    await cdp.intercept([{ urlPattern: '*' }], async (request, session) => {
      await session.send('Fetch.fulfillRequest', { requestId: request.requestId, responseCode: 200 })
      done.push(request.requestId)
      throw new Error('handler bug after cancellation')
    })
    provider.emit('Network.loadingFailed', { requestId: 'early-network', canceled: true })
    provider.emit('Fetch.requestPaused', pause('early-pause', 'early-network'))
    await waitFor(() => cdp.errors.length === 1)
    expect(done).toEqual(['early-pause'])
    expect(provider.commands.some(command => command.method === 'Fetch.fulfillRequest')).toBe(false)
    expect(cdp.errors).toEqual(['Fetch handler threw: handler bug after cancellation'])
  })
})

for (const [code, message, retired] of [
  [-32602, 'Invalid InterceptionId.', true],
  [-32602, 'Invalid parameters', false],
  [-32000, 'Invalid InterceptionId.', false],
] as const) {
  test(`an answer racing cancellation retires only its invalid-id response (${code}, ${message})`, async () => {
    await protocol(async (cdp, provider) => {
      provider.reply = command => {
        if (command.method !== 'Fetch.continueRequest') return {}
        provider.emit('Network.loadingFailed', { requestId: 'racing-network', canceled: true })
        return { error: { code, message } }
      }
      let done = false
      await cdp.intercept([{ urlPattern: '*' }], async (request, session) => {
        await session.send('Fetch.continueRequest', { requestId: request.requestId })
        done = true
      })
      provider.emit('Fetch.requestPaused', pause('racing-pause', 'racing-network'))
      await waitFor(() => done || cdp.errors.length > 0)
      expect(done).toBe(retired)
      expect(cdp.errors).toEqual(retired ? [] : [`Fetch handler threw: ${message}`])
    })
  })
}

test('unowned and uncorrelated invalid ids remain protocol failures', async () => {
  await protocol(async (cdp, provider) => {
    await expect(cdp.send('Fetch.continueRequest', { requestId: 'unknown' })).rejects.toThrow('Invalid InterceptionId.')
    await cdp.intercept([{ urlPattern: '*' }], async (request, session) => {
      await session.send('Fetch.continueRequest', { requestId: request.requestId })
    })
    provider.emit('Network.loadingFailed', { requestId: 'other-network', canceled: true })
    provider.emit('Fetch.requestPaused', pause('uncorrelated'))
    await waitFor(() => cdp.errors.length > 0)
    expect(cdp.errors).toEqual(['Fetch handler threw: Invalid InterceptionId.'])
  })
})

test('a later request and response pause remain answerable after another request was canceled', async () => {
  await protocol(async (cdp, provider) => {
    provider.reply = () => ({})
    const done: string[] = []
    await cdp.intercept([{ urlPattern: '*' }, { urlPattern: '*', requestStage: 'Response' }], async (request, session) => {
      await session.send('Fetch.continueRequest', { requestId: request.requestId })
      done.push(request.requestId)
    })
    provider.emit('Network.loadingFailed', { requestId: 'reused-network', canceled: true })
    provider.emit('Network.requestWillBeSent', { requestId: 'reused-network', request: { method: 'GET', url: 'http://localhost/api/work' } })
    provider.emit('Fetch.requestPaused', pause('live-pause', 'reused-network'))
    await waitFor(() => done.length === 1)
    provider.emit('Fetch.requestPaused', { ...pause('live-pause', 'reused-network'), responseStatusCode: 200 })
    await waitFor(() => done.length === 2)
    expect(provider.commands.filter(command => command.method === 'Fetch.continueRequest')).toHaveLength(2)
    expect(cdp.errors).toEqual([])
  })
})

test('a held canceled pause keeps its ownership while later answered requests are retired', async () => {
  await protocol(async (cdp, provider) => {
    provider.reply = () => ({})
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    let completed = 0
    await cdp.intercept([{ urlPattern: '*' }], async (request, session) => {
      if (request.requestId === 'held-canceled') await gate
      await session.send('Fetch.failRequest', { requestId: request.requestId, errorReason: 'Aborted' })
      completed++
    })
    provider.emit('Fetch.requestPaused', pause('held-canceled', 'held-network'))
    provider.emit('Network.loadingFailed', { requestId: 'held-network', canceled: true })
    for (let index = 0; index < 2100; index++) provider.emit('Fetch.requestPaused', pause(`later-${index}`, `network-${index}`))
    await waitFor(() => completed === 2100)
    release()
    await waitFor(() => completed === 2101)
    expect(provider.commands.some(command => command.params.requestId === 'held-canceled')).toBe(false)
    expect(cdp.errors).toEqual([])
  })
})

test('a noncancellation network failure and its invalid continuation remain observable', async () => {
  await protocol(async (cdp, provider) => {
    await cdp.intercept([{ urlPattern: '*' }], async (request, session) => {
      await session.send('Fetch.continueRequest', { requestId: request.requestId })
    })
    provider.emit('Network.loadingFailed', { requestId: 'failed-network', canceled: false, errorText: 'net::ERR_CONNECTION_RESET' })
    provider.emit('Fetch.requestPaused', pause('failed-pause', 'failed-network'))
    await waitFor(() => cdp.errors.length === 2)
    expect(cdp.errors).toEqual(['Network: net::ERR_CONNECTION_RESET', 'Fetch handler threw: Invalid InterceptionId.'])
    // A later cancellation cannot retroactively erase a reported failure.
    provider.emit('Network.loadingFailed', { requestId: 'failed-network', canceled: true })
    await cdp.send('Runtime.enable')
    expect(cdp.errors).toHaveLength(2)
  })
})

const realChrome = Boolean(findChrome()) && (process.env.CI ? process.env.STACKS_BROWSER_TESTS === '1' : process.env.STACKS_BROWSER_TESTS !== '0')

describe.skipIf(!realChrome)('interception cancellation in real Chrome', () => {
  test('an aborted paused fetch retires its interception before an async handler answers', async () => {
    const server = Bun.serve({
      hostname: '127.0.0.1',
      port: 0,
      fetch: request => new URL(request.url).pathname === '/api/work'
        ? Response.json({ ok: true })
        : new Response('<html><body>Cancellation fixture</body></html>', { headers: { 'Content-Type': 'text/html' } }),
    })
    let release!: () => void
    const held = new Promise<void>(resolve => { release = resolve })
    let browser: Awaited<ReturnType<typeof launch>> | undefined
    try {
      browser = await launch({ shared: false })
      const { cdp } = browser
      await cdp.send('Page.navigate', { url: `http://127.0.0.1:${server.port}/` })
      await waitFor(() => cdp.evaluate('document.readyState === "complete"'))
      let paused = false
      let answered = false
      const stop = await cdp.intercept([{ urlPattern: '*/api/work*' }], async (request, session) => {
        paused = true
        await held
        try { await session.send('Fetch.continueRequest', { requestId: request.requestId }) }
        finally { answered = true }
      })
      await cdp.evaluate(`globalThis.controller = new AbortController(); globalThis.outcome = 'pending'; fetch('/api/work', { signal: controller.signal }).then(() => outcome = 'completed', error => outcome = error.name); undefined`)
      await waitFor(() => paused)
      const canceled = cdp.once('Network.loadingFailed', event => event.canceled === true)
      await cdp.evaluate('controller.abort(); undefined')
      await canceled
      release()
      await waitFor(() => answered)
      // Let the handler rejection (if any) reach the public error report.
      await cdp.send('Runtime.enable')
      expect(await cdp.evaluate('outcome')).toBe('AbortError')
      expect(cdp.errors).toEqual([])
      await stop()
      expect(await cdp.evaluate(`fetch('/api/work').then(response => response.json())`)).toEqual({ ok: true })
    }
    finally {
      release()
      await browser?.close()
      server.stop(true)
    }
  }, 45_000)
})
