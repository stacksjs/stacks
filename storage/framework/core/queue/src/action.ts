import type { JobOptions } from '@stacksjs/types'
import { env as envVars } from '@stacksjs/env'

function getQueueDriver(): string {
  return envVars.QUEUE_DRIVER || 'sync'
}

/**
 * Stacks Job class for file-based jobs
 *
 * Supports both definition (in app/Jobs/*.ts) and dispatch.
 * Inspired by Laravel's dispatchable jobs.
 *
 * @example
 * ```typescript
 * // app/Jobs/SendWelcomeEmail.ts
 * export default new Job({
 *   name: 'SendWelcomeEmail',
 *   queue: 'emails',
 *   tries: 3,
 *   backoff: [10, 30, 60],
 *
 *   async handle(payload: { email: string }) {
 *     await sendEmail(payload.email)
 *   },
 * })
 *
 * // Dispatching:
 * import SendWelcomeEmail from '~/app/Jobs/SendWelcomeEmail'
 *
 * await SendWelcomeEmail.dispatch({ email: 'user@example.com' })
 * await SendWelcomeEmail.dispatchIf(user.isNew, { email: user.email })
 * await SendWelcomeEmail.dispatchAfter(60, { email: user.email })
 * await SendWelcomeEmail.dispatchNow({ email: user.email })
 * ```
 */
export class Job {
  name: JobOptions['name']
  description: JobOptions['description']
  action?: JobOptions['action']
  handle?: JobOptions['handle']
  queue?: string
  rate: JobOptions['rate']
  tries: JobOptions['tries']
  timeout?: number
  backoff: JobOptions['backoff']
  backoffConfig: JobOptions['backoffConfig']
  enabled: JobOptions['enabled']

  constructor(options: JobOptions & { queue?: string; timeout?: number }) {
    this.name = options.name
    this.description = options.description
    this.handle = options.handle
    this.queue = options.queue
    this.rate = options.rate
    this.action = options.action
    this.tries = options.tries
    this.timeout = options.timeout
    this.backoff = options.backoff
    this.backoffConfig = options.backoffConfig
    this.enabled = options.enabled
  }

  /**
   * Dispatch the job to the configured queue driver.
   */
  async dispatch(payload?: any): Promise<void> {
    // Check if queue is faked (testing mode)
    const { isFaked, getFakeQueue } = await import('./testing')
    if (isFaked()) {
      getFakeQueue()?.dispatch(this.name || 'UnknownJob', payload, {
        queue: this.queue,
        tries: this.tries,
        timeout: this.timeout,
      } as any)
      return
    }

    const driver = getQueueDriver()

    if (driver === 'sync') {
      return this.dispatchNow(payload)
    }

    if (driver === 'redis') {
      return this.dispatchToRedis(payload)
    }

    if (driver === 'database') {
      return this.dispatchToDatabase(payload)
    }

    // Fallback to sync
    return this.dispatchNow(payload)
  }

  /**
   * Dispatch only if the condition is true.
   */
  async dispatchIf(condition: boolean, payload?: any): Promise<void> {
    if (condition) {
      return this.dispatch(payload)
    }
  }

  /**
   * Dispatch unless the condition is true.
   */
  async dispatchUnless(condition: boolean, payload?: any): Promise<void> {
    if (!condition) {
      return this.dispatch(payload)
    }
  }

  /**
   * Dispatch with a delay (in seconds).
   */
  async dispatchAfter(delaySeconds: number, payload?: any): Promise<void> {
    const driver = getQueueDriver()

    if (driver === 'redis') {
      return this.dispatchToRedis(payload, { delay: delaySeconds })
    }

    if (driver === 'database') {
      return this.dispatchToDatabase(payload, { delay: delaySeconds })
    }

    // Sync: wait then execute
    await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000))
    return await this.dispatchNow(payload)
  }

  /**
   * Execute the job immediately, bypassing the queue.
   */
  async dispatchNow(payload?: any): Promise<void> {
    if (typeof this.handle === 'function') {
      await this.handle(payload)
    }
    else if (typeof this.action === 'string') {
      const { runAction } = await import('@stacksjs/actions')
      await runAction(this.action)
    }
    else if (typeof this.action === 'function') {
      await this.action()
    }
    else {
      throw new Error(`Job ${this.name} does not have a valid handler`)
    }
  }

  private async dispatchToDatabase(payload?: any, opts?: { delay?: number }): Promise<void> {
    const now = Math.floor(Date.now() / 1000)
    const availableAt = opts?.delay ? now + opts.delay : now

    const payloadObj = {
      jobName: this.name,
      payload,
      options: {
        queue: this.queue,
        tries: this.tries,
        timeout: this.timeout,
        backoff: this.backoff,
      },
    }

    const { db } = await import('@stacksjs/database')

    await db
      .insertInto('jobs')
      .values({
        queue: this.queue || 'default',
        payload: JSON.stringify(payloadObj),
        attempts: 0,
        reserved_at: null,
        available_at: availableAt,
        created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
      })
      .execute()
  }

  private async dispatchToRedis(payload?: any, opts?: { delay?: number }): Promise<void> {
    const { RedisQueue } = await import('./drivers/redis')
    const { queue: queueConfig } = await import('@stacksjs/config')
    const redisConfig = (queueConfig as any)?.connections?.redis

    if (!redisConfig) {
      throw new Error('Redis queue connection is not configured. Check config/queue.ts')
    }

    const queue = new RedisQueue(this.queue || 'default', redisConfig as any)

    await queue.add(
      {
        jobName: this.name,
        payload,
      } as any,
      {
        delay: opts?.delay,
        maxTries: this.tries,
        timeout: this.timeout,
        backoff: Array.isArray(this.backoff) ? this.backoff : undefined,
      },
    )
  }
}
