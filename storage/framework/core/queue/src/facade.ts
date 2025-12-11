/**
 * Queue Facade
 *
 * Provides a simple, driver-agnostic API for queue operations.
 * Automatically uses the configured default driver from queue config.
 */

import type {
  Dispatchable,
  QueueConfig,
  QueueConnectionConfig,
  QueueOption,
  RedisConnectionConfig,
} from '@stacksjs/types'
import { RedisQueue, StacksQueueManager } from './drivers/redis'
import { Queue as DatabaseQueue, runJob } from './job'

// Global queue manager instance
let queueManager: QueueFacade | null = null

/**
 * Queue driver interface
 */
export interface QueueDriver<T = any> {
  add(data: T, options?: QueueOption): Promise<any>
  process(concurrency: number, handler: (job: any) => Promise<any>): void
  getJob(jobId: string): Promise<any | null>
  getJobs(status: string): Promise<any[]>
  getJobCounts(): Promise<Record<string, number>>
  removeJob(jobId: string): Promise<void>
  pause(): Promise<void>
  resume(): Promise<void>
  empty(): Promise<void>
  close(): Promise<void>
}

/**
 * Sync driver - executes jobs immediately
 */
class SyncDriver<T = any> implements QueueDriver<T> {
  private handler: ((job: any) => Promise<any>) | null = null
  private jobCounter = 0

  async add(data: T, options?: QueueOption): Promise<{ id: string; data: T }> {
    const jobId = `sync-${++this.jobCounter}`
    const job = { id: jobId, data, opts: options || {} }

    // Execute immediately if handler is set
    if (this.handler) {
      await this.handler(job)
    }

    return job
  }

  process(_concurrency: number, handler: (job: any) => Promise<any>): void {
    this.handler = handler
  }

  async getJob(_jobId: string): Promise<any | null> {
    return null // Sync jobs are executed immediately
  }

  async getJobs(_status: string): Promise<any[]> {
    return []
  }

  async getJobCounts(): Promise<Record<string, number>> {
    return { waiting: 0, active: 0, completed: 0, failed: 0 }
  }

  async removeJob(_jobId: string): Promise<void> {}
  async pause(): Promise<void> {}
  async resume(): Promise<void> {}
  async empty(): Promise<void> {}
  async close(): Promise<void> {}
}

/**
 * Memory driver - in-memory queue for testing
 */
class MemoryDriver<T = any> implements QueueDriver<T> {
  private jobs: Map<string, { id: string; data: T; status: string; opts: any }> = new Map()
  private waitingQueue: string[] = []
  private handler: ((job: any) => Promise<any>) | null = null
  private processing = false
  private jobCounter = 0
  private concurrency = 1

  async add(data: T, options?: QueueOption): Promise<{ id: string; data: T }> {
    const jobId = `mem-${++this.jobCounter}`
    const job = { id: jobId, data, status: 'waiting', opts: options || {} }

    this.jobs.set(jobId, job)

    if (options?.delay) {
      setTimeout(() => {
        const j = this.jobs.get(jobId)
        if (j && j.status === 'waiting') {
          this.waitingQueue.push(jobId)
          this.processNext()
        }
      }, options.delay * 1000)
    } else {
      this.waitingQueue.push(jobId)
      this.processNext()
    }

    return job
  }

  process(concurrency: number, handler: (job: any) => Promise<any>): void {
    this.concurrency = concurrency
    this.handler = handler
    this.processNext()
  }

  private async processNext(): Promise<void> {
    if (!this.handler || this.processing) return

    const activeCount = Array.from(this.jobs.values()).filter(j => j.status === 'active').length
    if (activeCount >= this.concurrency) return

    const jobId = this.waitingQueue.shift()
    if (!jobId) return

    const job = this.jobs.get(jobId)
    if (!job) return

    job.status = 'active'
    this.processing = true

    try {
      await this.handler(job)
      job.status = 'completed'
    } catch (error) {
      job.status = 'failed'
    } finally {
      this.processing = false
      this.processNext()
    }
  }

  async getJob(jobId: string): Promise<any | null> {
    return this.jobs.get(jobId) || null
  }

  async getJobs(status: string): Promise<any[]> {
    return Array.from(this.jobs.values()).filter(j => j.status === status)
  }

  async getJobCounts(): Promise<Record<string, number>> {
    const counts: Record<string, number> = { waiting: 0, active: 0, completed: 0, failed: 0 }
    for (const job of this.jobs.values()) {
      counts[job.status] = (counts[job.status] || 0) + 1
    }
    return counts
  }

  async removeJob(jobId: string): Promise<void> {
    this.jobs.delete(jobId)
    this.waitingQueue = this.waitingQueue.filter(id => id !== jobId)
  }

  async pause(): Promise<void> {
    this.processing = false
  }

  async resume(): Promise<void> {
    this.processNext()
  }

  async empty(): Promise<void> {
    this.jobs.clear()
    this.waitingQueue = []
  }

  async close(): Promise<void> {
    this.processing = false
    this.handler = null
  }
}

/**
 * Database driver wrapper
 */
class DatabaseDriver<T = any> implements QueueDriver<T> {
  private queueName: string

  constructor(queueName: string) {
    this.queueName = queueName
  }

  async add(data: T, options?: QueueOption): Promise<any> {
    const job = new DatabaseQueue(this.queueName, data)
    if (options?.delay) job.delay(options.delay)
    if (options?.queue) job.onQueue(options.queue)
    if (options?.maxTries) job.tries(options.maxTries)
    await job.dispatch()
    return job
  }

  process(_concurrency: number, _handler: (job: any) => Promise<any>): void {
    // Database driver uses processJobs from process.ts
  }

  async getJob(_jobId: string): Promise<any | null> {
    // Would need to query the database
    return null
  }

  async getJobs(_status: string): Promise<any[]> {
    return []
  }

  async getJobCounts(): Promise<Record<string, number>> {
    return { waiting: 0, active: 0, completed: 0, failed: 0 }
  }

  async removeJob(_jobId: string): Promise<void> {}
  async pause(): Promise<void> {}
  async resume(): Promise<void> {}
  async empty(): Promise<void> {}
  async close(): Promise<void> {}
}

/**
 * Queue Facade - main entry point for queue operations
 */
export class QueueFacade {
  private drivers: Map<string, QueueDriver> = new Map()
  private config: QueueConfig
  private defaultConnection: string

  constructor(config: QueueConfig) {
    this.config = config
    this.defaultConnection = config.default || 'sync'
  }

  /**
   * Get or create a queue driver for the given connection
   */
  connection<T = any>(name?: string): QueueDriver<T> {
    const connectionName = name || this.defaultConnection

    if (this.drivers.has(connectionName)) {
      return this.drivers.get(connectionName) as QueueDriver<T>
    }

    const connectionConfig = this.config.connections?.[connectionName]
    if (!connectionConfig) {
      throw new Error(`Queue connection "${connectionName}" is not configured`)
    }

    const driver = this.createDriver<T>(connectionName, connectionConfig)
    this.drivers.set(connectionName, driver)
    return driver
  }

  /**
   * Create a driver based on configuration
   */
  private createDriver<T>(name: string, config: QueueConnectionConfig): QueueDriver<T> {
    switch (config.driver) {
      case 'redis':
        return new RedisQueue<T>(name, config as RedisConnectionConfig) as unknown as QueueDriver<T>
      case 'database':
        return new DatabaseDriver<T>(name)
      case 'memory':
        return new MemoryDriver<T>()
      case 'sync':
      default:
        return new SyncDriver<T>()
    }
  }

  /**
   * Push a job onto the queue
   */
  async push<T = any>(data: T, options?: QueueOption & { connection?: string }): Promise<any> {
    const driver = this.connection<T>(options?.connection)
    return driver.add(data, options)
  }

  /**
   * Push a job onto a specific queue
   */
  async pushOn<T = any>(queue: string, data: T, options?: QueueOption): Promise<any> {
    return this.push(data, { ...options, queue })
  }

  /**
   * Push a job with a delay
   */
  async later<T = any>(delay: number, data: T, options?: QueueOption): Promise<any> {
    return this.push(data, { ...options, delay })
  }

  /**
   * Push multiple jobs as a batch
   */
  async bulk<T = any>(jobs: Array<{ data: T; options?: QueueOption }>): Promise<any[]> {
    const driver = this.connection<T>()
    return Promise.all(jobs.map(job => driver.add(job.data, job.options)))
  }

  /**
   * Get the size of a queue
   */
  async size(queue?: string): Promise<number> {
    const driver = this.connection(queue)
    const counts = await driver.getJobCounts()
    return counts.waiting || 0
  }

  /**
   * Clear all jobs from a queue
   */
  async clear(queue?: string): Promise<void> {
    const driver = this.connection(queue)
    return driver.empty()
  }

  /**
   * Close all connections
   */
  async disconnect(): Promise<void> {
    const closePromises = Array.from(this.drivers.values()).map(d => d.close())
    await Promise.all(closePromises)
    this.drivers.clear()
  }

  /**
   * Get the default connection name
   */
  getDefaultConnection(): string {
    return this.defaultConnection
  }

  /**
   * Set the default connection
   */
  setDefaultConnection(name: string): void {
    this.defaultConnection = name
  }
}

/**
 * Initialize the queue manager with config
 */
export function initQueue(config: QueueConfig): QueueFacade {
  queueManager = new QueueFacade(config)
  return queueManager
}

/**
 * Get the queue manager instance
 */
export function getQueue(): QueueFacade {
  if (!queueManager) {
    throw new Error('Queue not initialized. Call initQueue() first.')
  }
  return queueManager
}

/**
 * Queue helper function - main entry point
 *
 * @example
 * ```typescript
 * // Push a job
 * await queue().push({ email: 'user@example.com' })
 *
 * // Push with delay
 * await queue().later(60, { email: 'user@example.com' })
 *
 * // Push to specific connection
 * await queue('redis').push({ email: 'user@example.com' })
 *
 * // Push to specific queue on connection
 * await queue().pushOn('emails', { email: 'user@example.com' })
 * ```
 */
export function queue(connection?: string): QueueFacade & { connection: (name?: string) => QueueDriver } {
  const manager = getQueue()

  if (connection) {
    // Return a facade that defaults to the specified connection
    const facade = Object.create(manager)
    facade.push = <T>(data: T, options?: QueueOption) =>
      manager.push(data, { ...options, connection })
    return facade
  }

  return manager as any
}

/**
 * Dispatch a job to the queue
 *
 * @example
 * ```typescript
 * await dispatch('SendEmail', { to: 'user@example.com' })
 * await dispatch({ type: 'SendEmail', to: 'user@example.com' })
 * ```
 */
export async function dispatch<T = any>(
  jobOrName: string | T,
  data?: T,
  options?: QueueOption,
): Promise<any> {
  const manager = getQueue()

  if (typeof jobOrName === 'string') {
    // Dispatch a named job
    return manager.push({ name: jobOrName, data }, options)
  }

  // Dispatch raw data
  return manager.push(jobOrName, options)
}

/**
 * Dispatch a job after a delay
 */
export async function dispatchLater<T = any>(
  delay: number,
  jobOrName: string | T,
  data?: T,
  options?: QueueOption,
): Promise<any> {
  return dispatch(jobOrName, data, { ...options, delay })
}

/**
 * Dispatch a job synchronously (using sync driver)
 */
export async function dispatchNow<T = any>(
  jobOrName: string | T,
  data?: T,
): Promise<any> {
  if (typeof jobOrName === 'string') {
    return runJob(jobOrName, { payload: data })
  }

  // For raw data, just return it as there's no handler
  return jobOrName
}
