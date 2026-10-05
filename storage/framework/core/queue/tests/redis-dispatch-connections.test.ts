import { config } from '@stacksjs/config'
import { afterAll, beforeAll, expect, test } from 'bun:test'
import { Job } from '../src/action'
import { closeSharedRedisQueues, RedisQueue } from '../src/drivers/redis'

/**
 * Dispatching to Redis does not open a connection per job.
 *
 * Every dispatch constructed a RedisQueue and never closed it: a connection,
 * the driver's Lua scripts and a stalled-job poller per queued job, for the
 * life of the process. Twenty dispatches held twenty connections open.
 */
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379/0'
const queueName = `stacks-dispatch-${process.pid}`
const probe = new RedisQueue(`${queueName}-probe`, { driver: 'redis', redis: { url: redisUrl } })
const savedQueue = config.queue
const savedDriver = process.env.QUEUE_DRIVER

async function connectedClients(): Promise<number> {
  const info = await (probe as any).queue.redisClient?.send?.('INFO', ['clients'])
    ?? await (probe as any).queue.client?.send?.('INFO', ['clients'])
  return Number(/connected_clients:(\d+)/.exec(String(info))?.[1])
}

beforeAll(async () => {
  expect(await probe.ping()).toBe(true)
  ;(config as any).queue = { ...savedQueue, connections: { ...savedQueue?.connections, redis: { driver: 'redis', redis: { url: redisUrl } } } }
  process.env.QUEUE_DRIVER = 'redis'
})

afterAll(async () => {
  await closeSharedRedisQueues()
  await new RedisQueue(queueName, { driver: 'redis', redis: { url: redisUrl } }).empty()
  await probe.close()
  ;(config as any).queue = savedQueue
  if (savedDriver === undefined) delete process.env.QUEUE_DRIVER
  else process.env.QUEUE_DRIVER = savedDriver
})

test('twenty dispatches share one connection', async () => {
  const before = await connectedClients()
  expect(Number.isFinite(before)).toBe(true)

  const job = new Job({ name: 'ConnectionProbe', queue: queueName, handle: () => {} })
  for (let i = 0; i < 20; i++)
    await job.dispatch({ i })

  const after = await connectedClients()
  expect(after - before).toBeLessThanOrEqual(2)
})
