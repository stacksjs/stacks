import assert from 'node:assert/strict'
import { AsyncLocalStorage } from 'node:async_hooks'
import { resolve } from 'node:path'
import type { BroadcastStreamMetadata, BroadcastStreamOptions } from '../../src/stream'

const mode = Bun.argv[2]
assert(mode === 'source' || mode === 'dist')
const { createBroadcastHub, createBroadcastResponse, emit, stopServer } = await import(resolve(import.meta.dir, mode === 'source' ? '../../src/index.ts' : '../../dist/index.js')) as typeof import('../../src/index')
const scenario = Bun.argv[3]
const observed: { chunk: Uint8Array, metadata: BroadcastStreamMetadata | null }[] = []
let closed = 0, reader: ReadableStreamDefaultReader<Uint8Array> | undefined
const options = (extra: Partial<BroadcastStreamOptions> = {}): BroadcastStreamOptions => ({
  channels: ['private-observer'],
  authorize: () => true,
  onEnqueue(chunk, metadata) { observed.push({ chunk, metadata }) },
  onClose() { closed++ },
  ...extra,
})
const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0))
try {
  createBroadcastHub()
  if (scenario === 'identity') {
    const response = await createBroadcastResponse(options())
    reader = response.body!.getReader()
    const connected = await reader.read()
    assert.equal(observed.length, 1, 'successful connected enqueue must be observable')
    assert.equal(observed[0]!.chunk, connected.value, 'observer must receive the exact native queued object')
    assert.equal(observed[0]!.metadata, null)
    assert.equal(new TextDecoder().decode(connected.value), ': connected\n\n')
    const original = { view: 'original-event' }
    emit('private-another-channel', 'progress', { unrelated: true })
    emit('private-observer', 'progress', original)
    const event = await reader.read()
    assert.equal(observed.length, 2)
    assert.equal(observed[1]!.chunk, event.value)
    assert.equal(observed[1]!.metadata!.channel, 'private-observer')
    assert.equal(observed[1]!.metadata!.event, 'progress')
    assert.equal(observed[1]!.metadata!.data, original)
    assert.equal(new TextDecoder().decode(event.value), 'data: {"channel":"private-observer","event":"progress","data":{"view":"original-event"}}\n\n')
    await reader.cancel()
    assert.equal(closed, 1, 'native cancellation must notify closure once')
    await reader.cancel()
    assert.equal(closed, 1)
  }
  else if (scenario === 'capacity') {
    const response = await createBroadcastResponse(options({ maxPending: 2 }))
    // The connected frame already occupies one native slot. No reader demand is needed for enqueue credit.
    emit('private-observer', 'progress', { view: 1 })
    await tick()
    assert.equal(observed.filter(item => item.metadata !== null).length, 1)
    emit('private-observer', 'progress', { view: 2 })
    await tick()
    emit('private-observer', 'progress', { view: 3 })
    await tick()
    assert.equal(closed, 1)
    assert.equal(observed.length, 2, 'full native queue cannot acknowledge skipped events')
    reader = response.body!.getReader()
    assert.equal((await reader.read()).value, observed[0]!.chunk)
    assert.equal((await reader.read()).value, observed[1]!.chunk)
    assert.equal((await reader.read()).done, true)
  }
  else if (scenario === 'pending') {
    let checks = 0, release!: () => void, entered!: () => void
    const barrier = new Promise<void>(resolve => { release = resolve })
    const checking = new Promise<void>(resolve => { entered = resolve })
    const response = await createBroadcastResponse(options({ maxPending: 2, authorize: async () => {
      if (++checks > 1) { entered(); await barrier }
      return true
    } }))
    reader = response.body!.getReader()
    await reader.read()
    emit('private-observer', 'progress', { view: 1 })
    await checking
    emit('private-observer', 'progress', { view: 2 })
    emit('private-observer', 'progress', { view: 3 })
    assert.equal(closed, 1, 'overflow must close while an authorization check is still pending')
    release()
    await tick()
    assert.equal((await reader.read()).done, true)
    assert.equal(observed.length, 1, 'late authorization must not enqueue after close')
    assert.equal(checks, 2)
  }
  else if (scenario === 'close') {
    for (const reason of ['abort', 'preaborted', 'cancel', 'auth-false', 'auth-throw'] as const) {
      observed.length = 0; closed = 0
      const abort = new AbortController()
      let checks = 0
      if (reason === 'preaborted') abort.abort()
      const response = await createBroadcastResponse(options({ signal: abort.signal, authorize: () => {
        if (++checks === 1 || !reason.startsWith('auth-')) return true
        if (reason === 'auth-throw') throw new Error('private authorization detail')
        return false
      } }))
      reader = response.body!.getReader()
      await reader.read()
      if (reason === 'cancel') await reader.cancel()
      else if (reason === 'abort') abort.abort()
      else if (reason.startsWith('auth-')) emit('private-observer', 'progress', { secret: true })
      assert.equal((await reader.read()).done, true)
      assert.equal(closed, 1, `${reason} closes exactly once`)
      abort.abort(); await reader.cancel()
      emit('private-observer', 'progress', { secret: true })
      await tick()
      assert.equal(observed.length, 1, `${reason} cannot enqueue another broadcast`)
      assert.equal(closed, 1)
    }
    closed = 0; observed.length = 0
    const denied = await createBroadcastResponse(options({ authorize: () => false }))
    assert.equal(denied.status, 401)
    assert.equal(closed, 0, 'initial denial creates no subscription to close')
    assert.equal(observed.length, 0)
    await assert.rejects(createBroadcastResponse(options({ authorize: () => { throw new Error('initial failure') } })), /initial failure/)
    assert.equal(closed, 0)
  }
  else if (scenario === 'context') {
    const identity = new AsyncLocalStorage<string>()
    let release!: () => void
    const barrier = new Promise<void>(resolve => { release = resolve })
    const captured: string[] = []
    const own = options({
      async authorize() { assert.equal(this, own); await barrier; captured.push(identity.getStore()!); return true },
      onEnqueue(chunk, metadata) { assert.equal(this, own); captured.push(identity.getStore()!); observed.push({ chunk, metadata }) },
      onClose() { assert.equal(this, own); captured.push(identity.getStore()!); closed++ },
    })
    const creating = identity.run('subscriber', () => createBroadcastResponse(own))
    own.onEnqueue = () => { throw new Error('observer was not captured before initial authorization await') }
    own.onClose = () => { throw new Error('close observer was not captured before initial authorization await') }
    release()
    const response = await creating
    reader = response.body!.getReader()
    await reader.read()
    identity.run('publisher', () => emit('private-observer', 'progress', { own: true }))
    await reader.read()
    await identity.run('canceller', () => reader!.cancel())
    assert.equal(closed, 1)
    assert.equal(captured.length, 5)
    assert(captured.every(item => item === 'subscriber'), 'all native callbacks must retain subscriber context')
  }
  else if (scenario === 'heartbeat') {
    const response = await createBroadcastResponse(options({ heartbeatMs: 5 }))
    reader = response.body!.getReader()
    await reader.read()
    const heartbeat = await reader.read()
    assert.equal(new TextDecoder().decode(heartbeat.value), ': heartbeat\n\n')
    assert.equal(observed[1]!.chunk, heartbeat.value)
    assert.equal(observed[1]!.metadata, null)
    await reader.cancel()
    let checks = 0
    const revoked = await createBroadcastResponse(options({ heartbeatMs: 5, authorize: () => ++checks === 1 }))
    reader = revoked.body!.getReader()
    await reader.read()
    assert.equal((await reader.read()).done, true)
    assert.equal(closed, 2)
  }
  else if (scenario === 'observer-failure') {
    for (const failure of ['enqueue-throw', 'enqueue-async', 'event-throw', 'event-async', 'close-throw', 'close-async', 'connected-abort'] as const) {
      closed = 0
      const abort = new AbortController()
      const response = await createBroadcastResponse(options({ signal: abort.signal, heartbeatMs: 5,
        onEnqueue(chunk, metadata) {
          void chunk
          if (failure === 'enqueue-throw') throw new Error('private observer detail')
          if (failure === 'enqueue-async') return Promise.reject(new Error('private async observer detail'))
          if (metadata && failure === 'event-throw') throw new Error('private event observer detail')
          if (metadata && failure === 'event-async') return Promise.reject(new Error('private async event detail'))
          if (failure === 'connected-abort') abort.abort()
        },
        onClose() {
          closed++
          if (failure === 'close-throw') throw new Error('private close detail')
          if (failure === 'close-async') return Promise.reject(new Error('private async close detail'))
        },
      }))
      reader = response.body!.getReader()
      assert.equal(new TextDecoder().decode((await reader.read()).value), ': connected\n\n')
      if (failure.startsWith('close-')) await reader.cancel()
      if (failure.startsWith('event-')) {
        emit('private-observer', 'progress', { view: true })
        assert.equal(new TextDecoder().decode((await reader.read()).value), 'data: {"channel":"private-observer","event":"progress","data":{"view":true}}\n\n')
      }
      assert.equal((await reader.read()).done, true)
      abort.abort(); await reader.cancel(); await tick()
      assert.equal(closed, 1, `${failure} must clean up without repeating close`)
    }
  }
  else if (scenario === 'defaults') {
    const response = await createBroadcastResponse({ channels: ['private-observer'], authorize: () => true })
    assert.equal(response.headers.get('content-type'), 'text/event-stream')
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.equal(response.headers.get('x-accel-buffering'), 'no')
    reader = response.body!.getReader()
    assert.equal(new TextDecoder().decode((await reader.read()).value), ': connected\n\n')
    emit('private-observer', 'progress', { view: 1 })
    assert.equal(new TextDecoder().decode((await reader.read()).value), 'data: {"channel":"private-observer","event":"progress","data":{"view":1}}\n\n')
    await reader.cancel()
  }
  else throw new Error(`Unknown observer scenario: ${scenario}`)
  console.log(`broadcast observer ${scenario} passed`)
}
finally {
  await reader?.cancel()
  await stopServer()
}
