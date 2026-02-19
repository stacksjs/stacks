import { describe, expect, it, mock } from 'bun:test'

// Mock logging to prevent process hanging
mock.module('@stacksjs/logging', () => ({
  log: {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    success: () => {},
  },
}))

describe('bun-queue integration', () => {
  describe('direct bun-queue import', () => {
    it('should import Queue class', async () => {
      const { Queue } = await import('bun-queue')
      expect(typeof Queue).toBe('function')
    })

    it('should import Job class', async () => {
      const { Job } = await import('bun-queue')
      expect(typeof Job).toBe('function')
    })

    it('should import Worker class', async () => {
      const { Worker } = await import('bun-queue')
      expect(typeof Worker).toBe('function')
    })

    it('should import dispatch functions', async () => {
      const bq = await import('bun-queue')
      expect(typeof bq.dispatch).toBe('function')
      expect(typeof bq.dispatchSync).toBe('function')
      expect(typeof bq.batch).toBe('function')
      expect(typeof bq.chain).toBe('function')
    })

    it('should import advanced features', async () => {
      const bq = await import('bun-queue')
      expect(typeof bq.DistributedLock).toBe('function')
      expect(typeof bq.LeaderElection).toBe('function')
      expect(typeof bq.RateLimiter).toBe('function')
      expect(typeof bq.DeadLetterQueue).toBe('function')
      expect(typeof bq.PriorityQueue).toBe('function')
      expect(typeof bq.QueueManager).toBe('function')
    })
  })

  describe('bun-queue config via bunfig', () => {
    it('should load config from ./config/queue.ts', async () => {
      const { getConfig } = await import('/Users/chrisbreuer/Code/Libraries/bun-queue/packages/bun-queue/src/config.ts')
      const config = await getConfig()

      // Should have merged Stacks config with bun-queue defaults
      expect(config.prefix).toBe('stacks:queue')
      expect(config.default).toBe('sync')
    })

    it('should include Stacks queue connections', async () => {
      const { getConfig } = await import('/Users/chrisbreuer/Code/Libraries/bun-queue/packages/bun-queue/src/config.ts')
      const config = await getConfig()

      expect(config.connections).toBeDefined()
      expect(config.connections.sync).toBeDefined()
      expect(config.connections.sync.driver).toBe('sync')
      expect(config.connections.database).toBeDefined()
      expect(config.connections.database.driver).toBe('database')
      expect(config.connections.redis).toBeDefined()
      expect(config.connections.redis.driver).toBe('redis')
    })

    it('should include redis connection settings', async () => {
      const { getConfig } = await import('/Users/chrisbreuer/Code/Libraries/bun-queue/packages/bun-queue/src/config.ts')
      const config = await getConfig()

      const redis = config.connections.redis
      expect(redis.redis).toBeDefined()
      expect(redis.redis.host).toBe('localhost')
      expect(redis.redis.port).toBe(6379)
    })

    it('should preserve bun-queue defaults for unset fields', async () => {
      const { getConfig } = await import('/Users/chrisbreuer/Code/Libraries/bun-queue/packages/bun-queue/src/config.ts')
      const config = await getConfig()

      // These come from bun-queue's defaultConfig
      expect(config.defaultJobOptions).toBeDefined()
      expect(config.defaultJobOptions.attempts).toBe(3)
      expect(config.stalledJobCheckInterval).toBe(30000)
      expect(config.maxStalledJobRetries).toBe(3)
    })
  })

  describe('@stacksjs/queue/bun-queue.ts re-exports', () => {
    it('should export Queue as BunJob', async () => {
      const { BunJob } = await import('@stacksjs/queue/bun-queue.ts')
      expect(typeof BunJob).toBe('function')
    })

    it('should export Worker', async () => {
      const { Worker } = await import('@stacksjs/queue/bun-queue.ts')
      expect(typeof Worker).toBe('function')
    })

    it('should export dispatch functions', async () => {
      const bqr = await import('@stacksjs/queue/bun-queue.ts')
      expect(typeof bqr.dispatch).toBe('function')
      expect(typeof bqr.dispatchSync).toBe('function')
      expect(typeof bqr.batch).toBe('function')
      expect(typeof bqr.chain).toBe('function')
    })

    it('should export middleware', async () => {
      const bqr = await import('@stacksjs/queue/bun-queue.ts')
      expect(typeof bqr.RateLimitMiddleware).toBe('function')
      expect(typeof bqr.UniqueJobMiddleware).toBe('function')
      expect(typeof bqr.ThrottleMiddleware).toBe('function')
    })
  })

  describe('Redis driver', () => {
    it('should import RedisQueue class', async () => {
      const { RedisQueue } = await import('../src/drivers/redis')
      expect(typeof RedisQueue).toBe('function')
    })

    it('should import StacksQueueManager', async () => {
      const { StacksQueueManager } = await import('../src/drivers/redis')
      expect(typeof StacksQueueManager).toBe('function')
    })

    it('should import createRedisDispatcher', async () => {
      const { createRedisDispatcher } = await import('../src/drivers/redis')
      expect(typeof createRedisDispatcher).toBe('function')
    })

    it('should import RedisJob', async () => {
      const { RedisJob } = await import('../src/drivers/redis')
      expect(typeof RedisJob).toBe('function')
    })
  })
})
