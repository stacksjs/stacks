import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { RedisQueue } from '../src/drivers/redis'

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379/0'
const queue = new RedisQueue<{ contract: string }>(`stacks-protocol-${process.pid}`, {
  driver: 'redis',
  redis: { url: redisUrl },
})

beforeAll(async () => {
  expect(await queue.ping()).toBe(true)
  await queue.empty()
})

afterAll(async () => {
  await queue.empty()
  await queue.close()
})

describe('Redis queue contract', () => {
  test('enqueues, looks up, counts, and removes a live Redis job', async () => {
    const added = await queue.add({ contract: 'live-redis' }, { maxTries: 1 })
    expect(added.id).toBeTruthy()

    const stored = await queue.getJob(added.id)
    expect(stored?.data).toEqual({ contract: 'live-redis' })

    const counts = await queue.getJobCounts()
    expect(counts.waiting).toBeGreaterThanOrEqual(1)

    await queue.removeJob(added.id)
    expect(await queue.getJob(added.id)).toBeNull()
  })
})
