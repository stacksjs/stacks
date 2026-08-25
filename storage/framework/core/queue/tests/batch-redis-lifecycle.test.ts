import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { RedisClient } from 'bun'
import { env } from '@stacksjs/env'
import { queue as queueConfig } from '@stacksjs/config'

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379/0'

// Deliberately NOT `mock.module('@stacksjs/env', ...)`.
//
// Bun loads every test file before running any of them, and `src/batch.ts` binds
// `envVars` from `@stacksjs/env` at import time. A module mock applied at the top
// of this file therefore replaces the module for the ONE cached `batch.ts`
// instance that every other queue test shares, so `getQueueDriver()` returned
// 'redis' repo-wide and the seven `batch-add-races` cases failed with
// "Batch batch-2282 not found" — reading Redis instead of their own database.
// `mock.restore()` does not undo `mock.module`, so the afterAll here could not
// have saved it either.
//
// `getQueueDriver()` and `batchRedisUrl()` both read their values at call time,
// so overriding the live objects inside beforeAll/afterAll gets the same effect
// scoped to this file's own run.
const original: { driver: unknown, redis: unknown } = { driver: undefined, redis: undefined }

const redis = new RedisClient(redisUrl)
const batchId = `batch-redis-lifecycle-${process.pid}`
const key = `stacks:batch:${batchId}`

const { recordBatchJobCompletion } = await import('../src/batch')

beforeAll(async () => {
  original.driver = (env as Record<string, unknown>).QUEUE_DRIVER
  ;(env as Record<string, unknown>).QUEUE_DRIVER = 'redis'

  const connections = (queueConfig as { connections?: Record<string, unknown> })?.connections
  if (connections) {
    original.redis = connections.redis
    connections.redis = { redis: { url: redisUrl } }
  }

  await redis.connect()
})

afterAll(async () => {
  await redis.del(key)
  redis.close()

  ;(env as Record<string, unknown>).QUEUE_DRIVER = original.driver
  const connections = (queueConfig as { connections?: Record<string, unknown> })?.connections
  if (connections && original.redis !== undefined)
    connections.redis = original.redis
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
