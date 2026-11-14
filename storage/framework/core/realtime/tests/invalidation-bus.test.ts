import { expect, test } from 'bun:test'
import { AsyncLocalStorage } from 'node:async_hooks'
import { createMemoryInvalidationBus } from '../src/invalidation-bus'

const tick = () => Bun.sleep(1)
test('explicit invalidations use an exact captured channel set and subscriber async context', async () => {
  const bus = createMemoryInvalidationBus(), context = new AsyncLocalStorage<string>(), received: unknown[] = []
  const channels = ['private-project.1']
  const remove = await context.run('subscriber', () => bus.subscribe({ channels, onInvalidate(notice) { received.push({ notice, context: context.getStore() }) } }))
  channels.push('private-project.2')
  await context.run('publisher', () => bus.publish('private-project.2'))
  await context.run('publisher', () => bus.publish('private-project.1'))
  await tick()
  expect(received).toEqual([{ notice: { channels: ['private-project.1'], reason: 'hint' }, context: 'subscriber' }])
  remove(); await bus.publish('private-project.1'); await tick()
  expect(received).toHaveLength(1)
  await bus.close()
  await expect(bus.publish('private-project.1')).rejects.toMatchObject({ code: 'invalidation_closed' })
})

test('slow handlers coalesce a bounded queue into resync and close on deadline', async () => {
  const bus = createMemoryInvalidationBus({ maxPending: 1, callbackTimeoutMs: 1000 }), entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>()
  const received: unknown[] = []
  let closed = 0
  await bus.subscribe({ channels: ['one', 'two', 'three'], async onInvalidate(notice) { received.push(notice); if (received.length === 1) { entered.resolve(); await release.promise } }, onClose() { closed++ } })
  await bus.publish('one'); await entered.promise
  await bus.publish('two'); await bus.publish('three')
  release.resolve(); await tick(); await tick()
  expect(received).toEqual([{ channels: ['one'], reason: 'hint' }, { channels: ['one', 'two', 'three'], reason: 'resync' }])
  expect(closed).toBe(0)
  const hanging = createMemoryInvalidationBus({ callbackTimeoutMs: 5 })
  await hanging.subscribe({ channels: ['one'], onInvalidate: () => new Promise(() => {}), onClose() { closed++ } })
  await hanging.publish('one'); await Bun.sleep(15)
  expect(closed).toBe(1)
  expect((await hanging.publish('one')).subscriberConnections).toBe(0)
  await Promise.all([bus.close(), hanging.close()])
})

test('abort and unsubscribe prevent scheduled callbacks and release bounded capacity', async () => {
  const bus = createMemoryInvalidationBus({ maxChannels: 1, maxSubscriptions: 1 }), controller = new AbortController()
  let calls = 0, closed = 0
  const remove = await bus.subscribe({ channels: ['one'], signal: controller.signal, onInvalidate() { calls++ }, onClose() { closed++ } })
  await expect(bus.subscribe({ channels: ['two'], onInvalidate() {} })).rejects.toMatchObject({ code: 'invalidation_capacity' })
  const pending = bus.publish('one'); controller.abort(); await pending; await tick()
  expect(calls).toBe(0); expect(closed).toBe(1)
  remove(); remove()
  const replacement = await bus.subscribe({ channels: ['two'], onInvalidate() { calls++ } })
  const scheduled = bus.publish('two'); replacement(); await scheduled; await tick()
  expect(calls).toBe(0)
  await expect(bus.subscribe({ channels: ['*'], onInvalidate() {} })).rejects.toThrow()
  await bus.close()
})
