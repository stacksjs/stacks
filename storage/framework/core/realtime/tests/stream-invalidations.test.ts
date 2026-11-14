import { afterEach, expect, test } from 'bun:test'
import { createMemoryInvalidationBus } from '../src/invalidation-bus'
import type { InvalidationBus } from '../src/invalidation-bus'
import { createBroadcastResponse } from '../src/stream'
import { createBroadcastHub, stopServer } from '../src/server-instance'
import { emit } from '../src/emit'

afterEach(async () => { await stopServer() })
const text = (value: Uint8Array | undefined) => value ? new TextDecoder().decode(value) : ''
test('opt-in stream hints preserve local bytes and check current authority for each hint', async () => {
  createBroadcastHub()
  const bus = createMemoryInvalidationBus(), selected = ['private-project.1'], entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>()
  let allowed = true, first = true, closed = 0
  const response = createBroadcastResponse({ channels: selected, invalidations: bus, heartbeatMs: 10000, async authorize() { if (first) { first = false; entered.resolve(); await release.promise } return allowed }, onClose() { closed++ } })
  await entered.promise; selected.push('private-project.2'); release.resolve()
  const stream = await response, reader = stream.body!.getReader()
  expect(text((await reader.read()).value)).toBe(': connected\n\n')
  expect((await bus.publish('private-project.2')).subscriberConnections).toBe(0)
  await bus.publish('private-project.1')
  expect(text((await reader.read()).value)).toBe('data: {"channel":"private-project.1","event":"invalidated","data":null}\n\n')
  emit('private-project.1', 'ordinary', { unchanged: true })
  expect(text((await reader.read()).value)).toBe('data: {"channel":"private-project.1","event":"ordinary","data":{"unchanged":true}}\n\n')
  bus.resync()
  expect(text((await reader.read()).value)).toContain('"event":"invalidated","data":null')
  allowed = false; await bus.publish('private-project.1')
  expect((await reader.read()).done).toBe(true)
  expect(closed).toBe(1)
  expect((await bus.publish('private-project.1')).subscriberConnections).toBe(0)
  await bus.close()
})

test('revocation during subscription readiness refuses the stream and releases its refs', async () => {
  createBroadcastHub()
  const bus = createMemoryInvalidationBus(), entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>()
  let allowed = true, closed = 0
  const delayed: InvalidationBus = { get status() { return bus.status }, publish: channel => bus.publish(channel), close: () => bus.close(), async subscribe(input) { const remove = await bus.subscribe(input); entered.resolve(); await release.promise; return remove } }
  const pending = createBroadcastResponse({ channels: ['private-project.1'], invalidations: delayed, authorize: () => allowed, onClose() { closed++ } })
  await entered.promise; allowed = false; release.resolve()
  expect((await pending).status).toBe(401)
  expect((await bus.publish('private-project.1')).subscriberConnections).toBe(0)
  expect(closed).toBe(0)
  await bus.close()
})

test('bus close terminates consumers once, while local-only callers retain their contract', async () => {
  createBroadcastHub()
  const bus = createMemoryInvalidationBus()
  let closed = 0
  const response = await createBroadcastResponse({ channels: ['private-project.1'], invalidations: bus, authorize: () => true, onClose() { closed++ } })
  const reader = response.body!.getReader(); await reader.read()
  await bus.close(); expect((await reader.read()).done).toBe(true); expect(closed).toBe(1)
  const local = await createBroadcastResponse({ channels: ['local'], authorize: () => true })
  const localReader = local.body!.getReader()
  expect(text((await localReader.read()).value)).toBe(': connected\n\n')
  emit('local', 'updated', 1)
  expect(text((await localReader.read()).value)).toBe('data: {"channel":"local","event":"updated","data":1}\n\n')
  await localReader.cancel()
})
