import { afterEach, describe, expect, it } from 'bun:test'
import { createBroadcastHub, stopServer } from '../src/server-instance'
import { createBroadcastResponse } from '../src/stream'
import { emit } from '../src/emit'

afterEach(() => stopServer())
describe('native authenticated broadcast streams', () => {
  it('uses the same broadcast engine, isolates channels and cancels its subscription', async () => {
    createBroadcastHub()
    const response = await createBroadcastResponse({ channels: ['private-user.1'], authorize: () => true })
    const reader = response.body!.getReader()
    expect(response.headers.get('content-type')).toBe('text/event-stream')
    await reader.read()
    emit('private-user.2', 'message', { other: true })
    emit('private-user.1', 'message', { id: 3 })
    const frame = new TextDecoder().decode((await reader.read()).value)
    expect(frame).toContain('"id":3')
    expect(frame).not.toContain('other')
    await reader.cancel()
    expect(() => emit('private-user.1', 'message', {})).not.toThrow()
  })
  it('denies a subscription and closes an existing stream when authorization is revoked', async () => {
    createBroadcastHub()
    expect((await createBroadcastResponse({ channels: ['private-user.1'], authorize: () => false })).status).toBe(401)
    let allowed = true
    const response = await createBroadcastResponse({ channels: ['private-user.1'], authorize: () => allowed })
    const reader = response.body!.getReader()
    await reader.read()
    allowed = false
    emit('private-user.1', 'message', { secret: true })
    expect((await reader.read()).done).toBe(true)
  })
  it('cleans up on abort and bounds a slow subscriber', async () => {
    createBroadcastHub()
    const abort = new AbortController()
    const response = await createBroadcastResponse({ channels: ['private-user.1'], authorize: () => true, signal: abort.signal })
    const reader = response.body!.getReader()
    await reader.read(); abort.abort()
    expect((await reader.read()).done).toBe(true)
    const slow = await createBroadcastResponse({ channels: ['private-user.1'], authorize: () => true, maxPending: 2 })
    for (let i = 0; i < 5; i++) emit('private-user.1', 'message', { i })
    const slowReader = slow.body!.getReader()
    await slowReader.read()
    expect((await slowReader.read()).done).toBe(true)
  })
})
