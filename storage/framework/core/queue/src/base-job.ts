/**
 * Stacks Job Base Class
 *
 * A comprehensive job base class that integrates with Stacks' action system,
 * provides middleware support, and handles retries, timeouts, and more.
 */

import type { Dispatchable, QueueBackoff, QueueOption } from '@stacksjs/types'
import { log } from '@stacksjs/logging'
import { dispatch, dispatchLater, getQueue } from './facade'

/**
 * Job middleware interface
 */
export interface JobMiddleware {
  (job: BaseJob, next: () => Promise<void>): Promise<void>
}

/**
 * Job configuration options
 */
export interface JobConfig {
  /** Queue name to dispatch to */
  queue?: string
  /** Connection name */
  connection?: string
  /** Number of retry attempts */
  tries?: number
  /** Maximum number of exceptions before failing */
  maxExceptions?: number
  /** Backoff configuration */
  backoff?: number | number[] | QueueBackoff
  /** Timeout in seconds */
  timeout?: number
  /** Delay before processing in seconds */
  delay?: number
  /** Whether to delete the job on completion */
  deleteWhenMissingModels?: boolean
  /** Rate limit key */
  rateLimitKey?: string
  /** Unique job identifier function */
  uniqueId?: () => string
  /** Unique lock duration in seconds */
  uniqueFor?: number
}

/**
 * Job result interface
 */
export interface JobResult<T = any> {
  success: boolean
  data?: T
  error?: Error
  duration?: number
}

/**
 * Abstract base class for all Stacks jobs
 *
 * @example
 * ```typescript
 * class SendEmailJob extends BaseJob {
 *   queue = 'emails'
 *   tries = 3
 *   timeout = 60
 *
 *   constructor(private email: string, private subject: string) {
 *     super()
 *   }
 *
 *   async handle(): Promise<void> {
 *     await sendEmail(this.email, this.subject)
 *   }
 *
 *   async failed(error: Error): Promise<void> {
 *     log.error(`Failed to send email to ${this.email}:`, error)
 *   }
 * }
 *
 * // Dispatch the job
 * await SendEmailJob.dispatch('user@example.com', 'Welcome!')
 * ```
 */
export abstract class BaseJob implements Dispatchable, JobConfig {
  // Job configuration
  queue?: string = 'default'
  connection?: string
  tries?: number = 3
  maxExceptions?: number
  backoff?: number | number[] | QueueBackoff
  timeout?: number = 60
  delay?: number
  deleteWhenMissingModels?: boolean = true
  rateLimitKey?: string
  uniqueFor?: number

  // Job state
  protected _attemptsMade = 0
  protected _jobId?: string
  protected _middleware: JobMiddleware[] = []

  /**
   * The main job handler - must be implemented by subclass
   */
  abstract handle(): Promise<void>

  /**
   * Called when the job fails after all retries
   */
  async failed(error: Error): Promise<void> {
    log.error(`Job ${this.constructor.name} failed:`, error)
  }

  /**
   * Called before the job is processed
   */
  async before(): Promise<void> {}

  /**
   * Called after the job is processed successfully
   */
  async after(): Promise<void> {}

  /**
   * Get the display name for the job
   */
  displayName(): string {
    return this.constructor.name
  }

  /**
   * Get the tags for the job (for logging/monitoring)
   */
  tags(): string[] {
    return [this.constructor.name]
  }

  /**
   * Generate a unique ID for this job
   */
  uniqueId(): string | undefined {
    return undefined
  }

  /**
   * Get middleware for this job
   */
  middleware(): JobMiddleware[] {
    return this._middleware
  }

  /**
   * Add middleware to this job
   */
  through(...middleware: JobMiddleware[]): this {
    this._middleware.push(...middleware)
    return this
  }

  /**
   * Calculate the retry delay based on attempt number
   */
  retryAfter(attempt: number): number {
    if (!this.backoff) return 0

    if (typeof this.backoff === 'number') {
      return this.backoff * 1000
    }

    if (Array.isArray(this.backoff)) {
      return (this.backoff[attempt - 1] || this.backoff[this.backoff.length - 1] || 0) * 1000
    }

    if (this.backoff.type === 'exponential') {
      return this.backoff.delay * Math.pow(2, attempt - 1)
    }

    return this.backoff.delay
  }

  /**
   * Check if the job should retry
   */
  shouldRetry(): boolean {
    return this._attemptsMade < (this.tries || 3)
  }

  /**
   * Get the number of attempts made
   */
  attempts(): number {
    return this._attemptsMade
  }

  /**
   * Set the job ID
   */
  setJobId(id: string): this {
    this._jobId = id
    return this
  }

  /**
   * Get the job ID
   */
  getJobId(): string | undefined {
    return this._jobId
  }

  /**
   * Release the job back to the queue with a delay
   */
  async release(delay?: number): Promise<void> {
    await dispatchLater(delay || 0, this.serialize())
  }

  /**
   * Delete the job from the queue
   */
  async delete(): Promise<void> {
    if (this._jobId) {
      const manager = getQueue()
      const driver = manager.connection(this.connection)
      await driver.removeJob(this._jobId)
    }
  }

  /**
   * Fail the job with an error
   */
  async fail(error?: Error): Promise<void> {
    await this.failed(error || new Error('Job manually failed'))
  }

  /**
   * Serialize the job for queue storage
   */
  serialize(): Record<string, any> {
    return {
      class: this.constructor.name,
      data: this.toJSON(),
      config: {
        queue: this.queue,
        connection: this.connection,
        tries: this.tries,
        timeout: this.timeout,
        backoff: this.backoff,
        delay: this.delay,
      },
    }
  }

  /**
   * Convert job to JSON (override for custom serialization)
   */
  toJSON(): Record<string, any> {
    const data: Record<string, any> = {}
    for (const key of Object.keys(this)) {
      if (!key.startsWith('_') && typeof (this as any)[key] !== 'function') {
        data[key] = (this as any)[key]
      }
    }
    return data
  }

  // Dispatchable interface implementation

  async dispatch(): Promise<void> {
    await dispatch(this.serialize(), undefined, this.getDispatchOptions())
  }

  async dispatchNow(): Promise<void> {
    await this.runWithMiddleware()
  }

  delay(seconds: number): this {
    this.delay = seconds
    return this
  }

  afterResponse(): this {
    // Will be dispatched after response is sent
    return this
  }

  chain(jobs: Dispatchable[]): this {
    // Chain jobs to run after this one
    return this
  }

  onQueue(queue: string): this {
    this.queue = queue
    return this
  }

  onConnection(connection: string): this {
    this.connection = connection
    return this
  }

  /**
   * Get dispatch options from job config
   */
  protected getDispatchOptions(): QueueOption {
    return {
      queue: this.queue,
      delay: this.delay,
      maxTries: this.tries,
      timeout: this.timeout,
      backoff: this.backoff as any,
    }
  }

  /**
   * Run the job with middleware
   */
  protected async runWithMiddleware(): Promise<void> {
    const middleware = this.middleware()
    let index = 0

    const next = async (): Promise<void> => {
      if (index < middleware.length) {
        await middleware[index++](this, next)
      } else {
        await this.executeJob()
      }
    }

    await next()
  }

  /**
   * Execute the job with lifecycle hooks
   */
  protected async executeJob(): Promise<void> {
    const startTime = Date.now()

    try {
      await this.before()
      await this.handle()
      await this.after()

      const duration = Date.now() - startTime
      log.debug(`Job ${this.displayName()} completed in ${duration}ms`)
    } catch (error) {
      this._attemptsMade++

      if (this.shouldRetry()) {
        const retryDelay = this.retryAfter(this._attemptsMade)
        log.warn(`Job ${this.displayName()} failed, retrying in ${retryDelay}ms (attempt ${this._attemptsMade}/${this.tries})`)
        await this.release(retryDelay / 1000)
      } else {
        await this.failed(error as Error)
        throw error
      }
    }
  }

  /**
   * Static dispatch method
   */
  static async dispatch<T extends BaseJob>(this: new (...args: any[]) => T, ...args: any[]): Promise<void> {
    const job = new this(...args)
    await job.dispatch()
  }

  /**
   * Static dispatch with delay
   */
  static async dispatchAfter<T extends BaseJob>(
    this: new (...args: any[]) => T,
    delay: number,
    ...args: any[]
  ): Promise<void> {
    const job = new this(...args)
    job.delay = delay
    await job.dispatch()
  }

  /**
   * Static dispatch now (sync)
   */
  static async dispatchNow<T extends BaseJob>(this: new (...args: any[]) => T, ...args: any[]): Promise<void> {
    const job = new this(...args)
    await job.dispatchNow()
  }
}

/**
 * Queueable trait mixin for adding queue capabilities to any class
 */
export function Queueable<T extends new (...args: any[]) => {}>(Base: T) {
  return class extends Base implements Dispatchable {
    queue?: string = 'default'
    connection?: string
    delay?: number

    async dispatch(): Promise<void> {
      await dispatch(this, undefined, {
        queue: this.queue,
        delay: this.delay,
      })
    }

    async dispatchNow(): Promise<void> {
      if ('handle' in this && typeof (this as any).handle === 'function') {
        await (this as any).handle()
      }
    }

    delay(seconds: number): this {
      this.delay = seconds
      return this
    }

    afterResponse(): this {
      return this
    }

    chain(_jobs: Dispatchable[]): this {
      return this
    }

    onQueue(queue: string): this {
      this.queue = queue
      return this
    }
  }
}

/**
 * Built-in middleware: Rate limit jobs
 */
export function rateLimited(key: string, maxAttempts: number, decaySeconds: number): JobMiddleware {
  const attempts = new Map<string, { count: number; resetAt: number }>()

  return async (job, next) => {
    const now = Date.now()
    const record = attempts.get(key) || { count: 0, resetAt: now + decaySeconds * 1000 }

    if (now > record.resetAt) {
      record.count = 0
      record.resetAt = now + decaySeconds * 1000
    }

    if (record.count >= maxAttempts) {
      log.warn(`Job ${job.displayName()} rate limited for key: ${key}`)
      await job.release(record.resetAt - now / 1000)
      return
    }

    record.count++
    attempts.set(key, record)
    await next()
  }
}

/**
 * Built-in middleware: Prevent overlapping jobs
 */
export function withoutOverlapping(key: string, releaseAfter: number = 0): JobMiddleware {
  const locks = new Map<string, number>()

  return async (job, next) => {
    const now = Date.now()
    const lockExpiry = locks.get(key) || 0

    if (lockExpiry > now) {
      if (releaseAfter > 0) {
        await job.release(releaseAfter)
      } else {
        await job.delete()
      }
      return
    }

    locks.set(key, now + (job.timeout || 60) * 1000)

    try {
      await next()
    } finally {
      locks.delete(key)
    }
  }
}

/**
 * Built-in middleware: Skip job if condition is true
 */
export function skipIf(condition: () => boolean | Promise<boolean>): JobMiddleware {
  return async (job, next) => {
    if (await condition()) {
      log.debug(`Job ${job.displayName()} skipped due to condition`)
      await job.delete()
      return
    }
    await next()
  }
}

/**
 * Built-in middleware: Only run on specific days/times
 */
export function runAt(options: { days?: number[]; hours?: number[]; minutes?: number[] }): JobMiddleware {
  return async (job, next) => {
    const now = new Date()
    const { days, hours, minutes } = options

    if (days && !days.includes(now.getDay())) {
      await job.release(60) // Release for 1 minute
      return
    }

    if (hours && !hours.includes(now.getHours())) {
      await job.release(60)
      return
    }

    if (minutes && !minutes.includes(now.getMinutes())) {
      await job.release(60)
      return
    }

    await next()
  }
}
