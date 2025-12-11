/**
 * Redis Queue Driver
 *
 * This driver wraps bun-queue to provide a Redis-backed queue system
 * with support for distributed locks, horizontal scaling, rate limiting,
 * dead letter queues, and more.
 */

import type { Dispatchable, QueueOption, RedisConnectionConfig } from '@stacksjs/types'
import {
  Queue as BunQueue,
  type Job as BunJob,
  type JobOptions as BunJobOptions,
  batch,
  chain,
  dispatch,
  dispatchAfter,
  dispatchSync,
  getQueueManager,
  QueueManager,
  setQueueManager,
} from 'bun-queue'
import { log } from '@stacksjs/logging'

// Re-export bun-queue types and utilities
export {
  batch,
  chain,
  dispatch,
  dispatchAfter,
  dispatchSync,
  getQueueManager,
  QueueManager,
  setQueueManager,
}

export type { BunJob, BunJobOptions }

/**
 * Redis Queue Driver class
 */
export class RedisQueue<T = any> {
  private queue: BunQueue<T>
  private config: RedisConnectionConfig
  private isProcessing = false

  constructor(name: string, config: RedisConnectionConfig) {
    this.config = config

    // Create the bun-queue instance with config mapping
    this.queue = new BunQueue<T>(name, {
      driver: 'redis',
      prefix: config.prefix,
      redis: config.redis ? {
        url: config.redis.url || this.buildRedisUrl(config.redis),
      } : undefined,
      defaultJobOptions: config.defaultJobOptions ? {
        delay: config.defaultJobOptions.delay,
        attempts: config.defaultJobOptions.attempts,
        backoff: config.defaultJobOptions.backoff,
        removeOnComplete: config.defaultJobOptions.removeOnComplete,
        removeOnFail: config.defaultJobOptions.removeOnFail,
        priority: config.defaultJobOptions.priority,
        lifo: config.defaultJobOptions.lifo,
        timeout: config.defaultJobOptions.timeout,
        jobId: config.defaultJobOptions.jobId,
        dependsOn: config.defaultJobOptions.dependsOn,
        keepJobs: config.defaultJobOptions.keepJobs,
        deadLetter: config.defaultJobOptions.deadLetter,
      } : undefined,
      limiter: config.limiter,
      metrics: config.metrics,
      stalledJobCheckInterval: config.stalledJobCheckInterval,
      maxStalledJobRetries: config.maxStalledJobRetries,
      distributedLock: config.distributedLock,
      defaultDeadLetterOptions: config.defaultDeadLetterOptions,
      horizontalScaling: config.horizontalScaling,
      logLevel: config.logLevel,
    })

    log.debug(`Redis queue "${name}" initialized`)
  }

  /**
   * Build Redis URL from config
   */
  private buildRedisUrl(redis: NonNullable<RedisConnectionConfig['redis']>): string {
    const host = redis.host || 'localhost'
    const port = redis.port || 6379
    const password = redis.password ? `:${redis.password}@` : ''
    const db = redis.db || 0

    return `redis://${password}${host}:${port}/${db}`
  }

  /**
   * Add a job to the queue
   */
  async add(data: T, options?: QueueOption): Promise<BunJob<T>> {
    const jobOptions: BunJobOptions = {
      delay: options?.delay ? options.delay * 1000 : undefined, // Convert seconds to ms
      attempts: options?.maxTries,
      priority: options?.priority,
      timeout: options?.timeout ? options.timeout * 1000 : undefined,
      backoff: Array.isArray(options?.backoff)
        ? { type: 'fixed', delay: options.backoff[0] || 1000 }
        : options?.backoff,
    }

    return this.queue.add(data, jobOptions)
  }

  /**
   * Process jobs with a handler
   */
  process(concurrency: number, handler: (job: BunJob<T>) => Promise<any>): void {
    if (this.isProcessing) {
      log.warn('Queue is already processing')
      return
    }

    this.isProcessing = true
    this.queue.process(concurrency, handler)
    log.info(`Started processing queue with concurrency ${concurrency}`)
  }

  /**
   * Get a job by ID
   */
  async getJob(jobId: string): Promise<BunJob<T> | null> {
    return this.queue.getJob(jobId)
  }

  /**
   * Get jobs by status
   */
  async getJobs(status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed'): Promise<BunJob<T>[]> {
    return this.queue.getJobs(status)
  }

  /**
   * Get job counts by status
   */
  async getJobCounts(): Promise<Record<string, number>> {
    return this.queue.getJobCounts()
  }

  /**
   * Remove a job
   */
  async removeJob(jobId: string): Promise<void> {
    return this.queue.removeJob(jobId)
  }

  /**
   * Pause the queue
   */
  async pause(): Promise<void> {
    return this.queue.pause()
  }

  /**
   * Resume the queue
   */
  async resume(): Promise<void> {
    return this.queue.resume()
  }

  /**
   * Empty the queue
   */
  async empty(): Promise<void> {
    return this.queue.empty()
  }

  /**
   * Close the queue
   */
  async close(): Promise<void> {
    this.isProcessing = false
    return this.queue.close()
  }

  /**
   * Get queue metrics
   */
  async getMetrics(): Promise<any> {
    return this.queue.getMetrics()
  }

  /**
   * Check if queue is healthy
   */
  async ping(): Promise<boolean> {
    return this.queue.ping()
  }

  /**
   * Schedule a cron job
   */
  async scheduleCron(options: {
    cron: string
    data: T
    tz?: string
    name?: string
  }): Promise<string> {
    return this.queue.scheduleCron({
      cron: options.cron,
      data: options.data,
      tz: options.tz,
      name: options.name,
    })
  }

  /**
   * Unschedule a cron job
   */
  async unscheduleCron(jobId: string): Promise<boolean> {
    return this.queue.unscheduleCron(jobId)
  }

  /**
   * Get dead letter queue jobs
   */
  async getDeadLetterJobs(): Promise<BunJob<T>[]> {
    return this.queue.getDeadLetterJobs()
  }

  /**
   * Republish a job from the dead letter queue
   */
  async republishDeadLetterJob(jobId: string): Promise<BunJob<T> | null> {
    return this.queue.republishDeadLetterJob(jobId)
  }

  /**
   * Clear the dead letter queue
   */
  async clearDeadLetterQueue(): Promise<void> {
    return this.queue.clearDeadLetterQueue()
  }

  /**
   * Bulk remove jobs
   */
  async bulkRemove(jobIds: string[]): Promise<number> {
    return this.queue.bulkRemove(jobIds)
  }

  /**
   * Get cluster info (for horizontal scaling)
   */
  async getClusterInfo(): Promise<Record<string, any> | null> {
    return this.queue.getClusterInfo()
  }

  /**
   * Check if this instance is the leader
   */
  isLeader(): boolean {
    return this.queue.isLeader()
  }

  /**
   * Get the underlying bun-queue instance
   */
  getQueue(): BunQueue<T> {
    return this.queue
  }

  /**
   * Subscribe to queue events
   */
  on<E extends keyof QueueEvents>(event: E, handler: QueueEvents[E]): void {
    this.queue.events.on(event, handler as any)
  }
}

/**
 * Queue events interface
 */
interface QueueEvents {
  jobAdded: (jobId: string, name: string) => void
  jobCompleted: (jobId: string, result: any) => void
  jobFailed: (jobId: string, error: Error) => void
  jobProgress: (jobId: string, progress: number) => void
  jobActive: (jobId: string) => void
  jobStalled: (jobId: string) => void
  jobDelayed: (jobId: string, delay: number) => void
  ready: () => void
  error: (error: Error) => void
}

/**
 * Queue Manager for multiple queue connections
 */
export class StacksQueueManager {
  private queues = new Map<string, RedisQueue<any>>()
  private defaultConnection: string = 'default'

  constructor(private config: Record<string, RedisConnectionConfig>) {
    // Initialize queues from config
    for (const [name, connectionConfig] of Object.entries(config)) {
      if (connectionConfig.driver === 'redis') {
        this.queues.set(name, new RedisQueue(name, connectionConfig))
      }
    }
  }

  /**
   * Get a queue by name
   */
  queue<T = any>(name?: string): RedisQueue<T> {
    const queueName = name || this.defaultConnection
    let queue = this.queues.get(queueName)

    if (!queue) {
      const config = this.config[queueName]
      if (!config) {
        throw new Error(`Queue "${queueName}" not configured`)
      }
      queue = new RedisQueue(queueName, config)
      this.queues.set(queueName, queue)
    }

    return queue as RedisQueue<T>
  }

  /**
   * Set the default connection
   */
  setDefaultConnection(name: string): void {
    this.defaultConnection = name
  }

  /**
   * Close all queues
   */
  async closeAll(): Promise<void> {
    const closePromises = Array.from(this.queues.values()).map(q => q.close())
    await Promise.all(closePromises)
    this.queues.clear()
  }
}

/**
 * Create a Redis queue dispatcher
 */
export function createRedisDispatcher<T = any>(
  queueName: string,
  config: RedisConnectionConfig,
): (data: T, options?: QueueOption) => Promise<BunJob<T>> {
  const queue = new RedisQueue<T>(queueName, config)

  return async (data: T, options?: QueueOption) => {
    return queue.add(data, options)
  }
}

/**
 * Dispatchable job wrapper for Redis queue
 */
export class RedisJob<T = any> implements Dispatchable {
  protected options: QueueOption = {}
  private queue: RedisQueue<T>

  constructor(
    queueName: string,
    config: RedisConnectionConfig,
    protected data: T,
  ) {
    this.queue = new RedisQueue<T>(queueName, config)
  }

  async dispatch(): Promise<void> {
    await this.queue.add(this.data, this.options)
  }

  async dispatchNow(): Promise<void> {
    // For immediate execution, we add and process immediately
    const job = await this.queue.add(this.data, { ...this.options, immediate: true })
    // The job will be processed by the worker
  }

  delay(seconds: number): this {
    this.options.delay = seconds
    return this
  }

  afterResponse(): this {
    this.options.afterResponse = true
    return this
  }

  chain(jobs: Dispatchable[]): this {
    this.options.chainedJobs = jobs
    return this
  }

  onQueue(queue: string): this {
    this.options.queue = queue
    return this
  }

  priority(level: number): this {
    this.options.priority = level
    return this
  }

  tries(count: number): this {
    this.options.maxTries = count
    return this
  }

  timeout(seconds: number): this {
    this.options.timeout = seconds
    return this
  }

  backoff(attempts: number[]): this {
    this.options.backoff = attempts
    return this
  }
}
