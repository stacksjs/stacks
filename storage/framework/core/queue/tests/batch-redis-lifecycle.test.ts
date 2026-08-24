import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test'
import { RedisClient } from 'bun'

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379/0'

mock.module('@stacksjs/logging', () => ({
  log: {
    debug() {},
    error() {},
    info() {},
    warn() {},
  },
}))
mock.module('@stacksjs/env', () => ({ env: { QUEUE_DRIVER: 'redis' } }))
mock.module('@stacksjs/config', () => ({
  queue: {
    connections: {
      redis: { redis: { url: redisUrl } },
    },
  },
}))

const redis = new RedisClient(redisUrl)
const batchId = `batch-redis-lifecycle-${process.pid}`
const key = `stacks:batch:${batchId}`

const { recordBatchJobCompletion } = await import('../src/batch')

beforeAll(async () => {
  await redis.connect()
})

afterAll(async () => {
  await redis.del(key)
  redis.close()
  mock.restore()
})

describe('Redis batch lifecycle accounting (#2354)', () => {
  test('a duplicate completion cannot push pending_jobs below zero', async () => {
    await redis.hset(key, {
      id: batchId,
      name: 'Redis lifecycle regression',
      total_jobs: '1',
      pending_jobs: '1',
      failed_jobs: '0',
      failed_job_ids: '[]',
      options: '{}',
      cancelled_at: '',
      created_at: '2026-08-24 00:00:00',
      finished_at: '',
      terminal_claimed: '',
      then_handler: '',
      catch_handler: '',
      finally_handler: '',
    })

    await recordBatchJobCompletion(batchId)
    await recordBatchJobCompletion(batchId)

    expect(await redis.hget(key, 'pending_jobs')).toBe('0')
  })

  test('a Redis command failure propagates and closes the bookkeeping client', async () => {
    await redis.del(key)
    await redis.hset(key, {
      id: batchId,
      pending_jobs: 'not-an-integer',
      finished_at: '',
    })

    const clientsBefore = String(await redis.send('CLIENT', ['LIST']))
      .split('\n')
      .filter(line => line.startsWith('id='))
      .length

    await expect(recordBatchJobCompletion(batchId)).rejects.toThrow(/integer/i)

    const clientsAfter = String(await redis.send('CLIENT', ['LIST']))
      .split('\n')
      .filter(line => line.startsWith('id='))
      .length
    expect(clientsAfter).toBe(clientsBefore)
  })
})
