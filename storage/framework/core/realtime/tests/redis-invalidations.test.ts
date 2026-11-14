import { expect, test } from 'bun:test'
import { RedisClient } from 'bun'
import { createHash, randomUUID } from 'node:crypto'
import { createRedisInvalidationBus, supportsRedisInvalidations } from '../src/redis-invalidations'
import { ownedRedisBinary, ownedRedisFixture } from './fixtures/owned-redis'

async function until(predicate: () => boolean) { const end = Date.now() + 10000; while (!predicate()) { if (Date.now() > end) throw new Error('Invalidation observation timed out'); await Bun.sleep(5) } }
test('missing native Pub/Sub is explicitly unavailable without creating clients', async () => {
  expect(supportsRedisInvalidations({})).toBe(false)
  expect(supportsRedisInvalidations({ RedisClient: class { connect() {} close() {} } })).toBe(false)
  expect(supportsRedisInvalidations(Bun)).toBe(true)
  expect(() => createRedisInvalidationBus({ url: 'redis://127.0.0.1:1', namespace: '*' })).toThrow('namespace')
  const bus = createRedisInvalidationBus({ url: 'redis://127.0.0.1:1', namespace: 'readonly-status' })
  expect(bus.status).toBe('idle')
  expect(Reflect.set(bus, 'status', 'ready')).toBe(false)
  expect(bus.status).toBe('idle')
  await bus.close()
  expect(bus.status).toBe('closed')
  expect(Reflect.set(bus, 'status', 'ready')).toBe(false)
  await expect(bus.publish('one')).rejects.toMatchObject({ code: 'invalidation_closed' })
})
test.skipIf(!ownedRedisBinary)('owned native Redis exact subscriptions, own echo and reconnect resync', async () => {
  const redis = await ownedRedisFixture(), notices: string[] = [], other: string[] = [], states: string[] = []
  const first = createRedisInvalidationBus({ url: redis.url, namespace: 'owned-alpha', connectTimeoutMs: 200, operationTimeoutMs: 200, reconnectDelayMs: 10, maxReconnectDelayMs: 50, onStatus: state => states.push(state) })
  const second = createRedisInvalidationBus({ url: redis.url, namespace: 'owned-alpha', connectTimeoutMs: 200, operationTimeoutMs: 200, reconnectDelayMs: 10, maxReconnectDelayMs: 50 })
  const foreign = createRedisInvalidationBus({ url: redis.url, namespace: 'owned-beta', connectTimeoutMs: 200, operationTimeoutMs: 200 })
  try {
    const [major, minor] = redis.version.split('.').map(Number)
    expect(major! > 7 || major === 7 && minor! >= 2).toBe(true)
    console.info(`Owned Redis invalidation qualification: Bun ${Bun.version}, Redis ${redis.version}`)
    const release = await first.subscribe({ channels: ['private-project.1'], onInvalidate: notice => { notices.push(notice.reason + ':' + notice.channels.join(',')) } })
    await second.subscribe({ channels: ['private-project.1'], onInvalidate: notice => { other.push(notice.reason) } })
    await foreign.publish('private-project.1'); await Bun.sleep(20)
    expect(notices).toEqual([])
    await first.publish('private-project.1')
    await until(() => notices.length === 1 && other.length === 1)
    await Bun.sleep(20)
    expect(notices).toEqual(['hint:private-project.1'])
    const raw = new RedisClient(redis.url, { autoReconnect: false, enableOfflineQueue: false, maxRetries: 0 })
    raw.onclose = () => {}
    try {
      await raw.connect()
      const physical = `owned-alpha:invalidation:v1:${createHash('sha256').update('private-project.1').digest('hex')}`
      const hint = JSON.stringify({ v: 1, origin: randomUUID(), id: randomUUID() })
      await raw.publish(physical, hint); await raw.publish(physical, hint)
      await until(() => notices.length === 2 && other.length === 2); await Bun.sleep(20)
      expect(notices).toHaveLength(2)
      await raw.publish(physical, 'x'.repeat(512)); await Bun.sleep(20)
      expect(notices).toHaveLength(2)
    }
    finally { raw.close() }
    await second.publish('private-project.2'); await Bun.sleep(20)
    expect(notices).toHaveLength(2)
    await redis.stop()
    await until(() => states.includes('disconnected'))
    await expect(second.publish('private-project.1')).rejects.toMatchObject({ code: 'invalidation_unavailable' })
    const previous = notices.length
    await redis.restart()
    await until(() => notices.slice(previous).includes('resync:private-project.1'))
    expect(first.status).toBe('ready')
    const before = notices.length
    await second.publish('private-project.1'); await until(() => notices.length > before)
    release(); const unsubscribed = notices.length
    await second.publish('private-project.1'); await Bun.sleep(20)
    expect(notices).toHaveLength(unsubscribed)
  }
  finally { await Promise.all([first.close(), second.close(), foreign.close()]); await redis.close() }
}, 30000)
