/**
 * Stacks Job Helper
 *
 * Simple helper for dispatching file-based jobs from app/Jobs/*.ts
 * For class-based jobs, use bun-queue's JobBase directly.
 */

import { appPath } from '@stacksjs/path'
import { env as envVars } from '@stacksjs/env'

function getQueueDriver(): string {
  return envVars.QUEUE_DRIVER || 'sync'
}

/**
 * Options for job dispatch
 */
export interface JobDispatchOptions {
  /** Queue name to dispatch to */
  queue?: string
  /** Delay in seconds before processing */
  delay?: number
  /** Number of retry attempts */
  tries?: number
  /** Timeout in seconds */
  timeout?: number
  /** Backoff delays in seconds */
  backoff?: number[]
  /** Additional context */
  context?: any
}

/**
 * Fluent job builder for file-based jobs
 */
class JobBuilder {
  private options: JobDispatchOptions = {}

  constructor(
    private name: string,
    private payload?: any,
  ) {}

  /**
   * Set the queue name
   */
  onQueue(queue: string): this {
    this.options.queue = queue
    return this
  }

  /**
   * Set delay before processing (in seconds)
   */
  delay(seconds: number): this {
    this.options.delay = seconds
    return this
  }

  /**
   * Set number of retry attempts
   */
  tries(count: number): this {
    this.options.tries = count
    return this
  }

  /**
   * Set timeout (in seconds)
   */
  timeout(seconds: number): this {
    this.options.timeout = seconds
    return this
  }

  /**
   * Set backoff delays (in seconds)
   */
  backoff(delays: number[]): this {
    this.options.backoff = delays
    return this
  }

  /**
   * Add context to the job
   */
  withContext(context: any): this {
    this.options.context = context
    return this
  }

  /**
   * Dispatch the job to the queue
   */
  async dispatch(): Promise<void> {
    // Check if queue is faked (testing mode)
    const { isFaked, getFakeQueue } = await import('./testing')
    if (isFaked()) {
      getFakeQueue()?.dispatch(this.name, this.payload, this.options as any)
      return
    }

    const driver = getQueueDriver()

    if (driver === 'database') {
      await this.dispatchToDatabase()
    }
    else if (driver === 'redis') {
      await this.dispatchToRedis()
    }
    else if (driver === 'sync') {
      await runJob(this.name, { payload: this.payload, context: this.options.context })
    }
    else {
      await runJob(this.name, { payload: this.payload, context: this.options.context })
    }
  }

  /**
   * Dispatch only if the condition is true
   */
  async dispatchIf(condition: boolean): Promise<void> {
    if (condition) {
      await this.dispatch()
    }
  }

  /**
   * Dispatch unless the condition is true
   */
  async dispatchUnless(condition: boolean): Promise<void> {
    if (!condition) {
      await this.dispatch()
    }
  }

  /**
   * Dispatch the job to the database queue
   */
  private async dispatchToDatabase(): Promise<void> {
    const now = Math.floor(Date.now() / 1000)
    const availableAt = this.options.delay ? now + this.options.delay : now

    const payloadObj = {
      jobName: this.name,
      payload: this.payload,
      options: this.options,
    }

    const { db } = await import('@stacksjs/database')

    await db
      .insertInto('jobs')
      .values({
        queue: this.options.queue || 'default',
        payload: JSON.stringify(payloadObj),
        attempts: 0,
        reserved_at: null,
        available_at: availableAt,
        created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
      })
      .execute()
  }

  /**
   * Dispatch the job to Redis via bun-queue
   */
  private async dispatchToRedis(): Promise<void> {
    const { RedisQueue } = await import('./drivers/redis')
    const { queue: queueConfig } = await import('@stacksjs/config')
    const redisConfig = (queueConfig as any)?.connections?.redis

    if (!redisConfig) {
      throw new Error('Redis queue connection is not configured. Check config/queue.ts')
    }

    const queue = new RedisQueue(this.options.queue || 'default', redisConfig as any)

    await queue.add(
      {
        jobName: this.name,
        payload: this.payload,
      } as any,
      {
        delay: this.options.delay,
        maxTries: this.options.tries,
        timeout: this.options.timeout,
        backoff: this.options.backoff,
      },
    )
  }

  /**
   * Dispatch the job synchronously (immediate execution)
   */
  async dispatchNow(): Promise<void> {
    await runJob(this.name, {
      payload: this.payload,
      context: this.options.context,
    })
  }
}

/**
 * Create a job builder for dispatching file-based jobs
 *
 * @example
 * ```typescript
 * // Basic dispatch
 * await job('SendWelcomeEmail', { userId: 1 }).dispatch()
 *
 * // With options
 * await job('ProcessOrder', { orderId: 123 })
 *   .onQueue('orders')
 *   .tries(3)
 *   .backoff([10, 30, 60])
 *   .dispatch()
 *
 * // Immediate execution
 * await job('SendNotification', { message: 'Hello' }).dispatchNow()
 * ```
 */
export function job(name: string, payload?: any): JobBuilder {
  return new JobBuilder(name, payload)
}

/**
 * Laravel-style static facade for the file-based job dispatcher. The
 * existing `Job` class (in ./action.ts) is the *declaration* form used
 * inside `app/Jobs/*.ts`; this `Jobs` facade is the *call-site* form for
 * dispatching by name from anywhere in the app. It lets one-liner
 * dispatches skip the builder while still allowing the chainable form
 * via `Jobs.make(...)` for option-heavy cases.
 *
 * @example
 * ```typescript
 * // One-shot dispatch (no options)
 * await Jobs.dispatch('SendWelcomeEmail', { userId: 1 })
 *
 * // Conditional dispatch
 * await Jobs.dispatchIf(user.isNew, 'SendWelcomeEmail', { userId: user.id })
 *
 * // With options — fall back to the builder
 * await Jobs.make('ProcessOrder', { orderId: 123 })
 *   .onQueue('orders')
 *   .tries(3)
 *   .dispatch()
 *
 * // Immediate (synchronous) execution, ignoring the queue
 * await Jobs.dispatchNow('SendNotification', { message: 'Hello' })
 * ```
 */
export const Jobs = {
  /** Construct a builder without dispatching — for chained option calls. */
  make(name: string, payload?: any): JobBuilder {
    return new JobBuilder(name, payload)
  },

  /** Dispatch a job in one call. Equivalent to `job(name, payload).dispatch()`. */
  async dispatch(name: string, payload?: any): Promise<void> {
    await new JobBuilder(name, payload).dispatch()
  },

  /** Dispatch only if `condition` is truthy. */
  async dispatchIf(condition: boolean, name: string, payload?: any): Promise<void> {
    if (condition) await new JobBuilder(name, payload).dispatch()
  },

  /** Dispatch unless `condition` is truthy. */
  async dispatchUnless(condition: boolean, name: string, payload?: any): Promise<void> {
    if (!condition) await new JobBuilder(name, payload).dispatch()
  },

  /** Run the job synchronously, bypassing the queue. */
  async dispatchNow(name: string, payload?: any): Promise<void> {
    await new JobBuilder(name, payload).dispatchNow()
  },

  /** Schedule the job to run after `seconds` of delay. */
  dispatchAfter(seconds: number, name: string, payload?: any): JobBuilder {
    return new JobBuilder(name, payload).delay(seconds)
  },
}

/**
 * Create a job batch for dispatching multiple jobs together
 *
 * @example
 * ```typescript
 * import SendWelcomeEmail from '~/app/Jobs/SendWelcomeEmail'
 * import ProcessOrder from '~/app/Jobs/ProcessOrder'
 *
 * const batch = await jobBatch([
 *   { job: SendWelcomeEmail, payload: { email: 'user@example.com' } },
 *   { job: ProcessOrder, payload: { orderId: 123 } },
 * ])
 *   .name('Onboard User')
 *   .allowFailures()
 *   .then(async (_b) => console.log('All done!'))
 *   .dispatch()
 * ```
 */
export function jobBatch(jobs: Array<import('./action').Job | import('./batch').BatchableJob>): import('./batch').PendingBatch {
  // Use inline require for synchronous access - batch module is local
  // eslint-disable-next-line ts/no-require-imports
  const { PendingBatch } = require('./batch') as typeof import('./batch')
  return new PendingBatch(jobs)
}

/**
 * Run a job immediately by name
 *
 * This loads the job from app/Jobs/{name}.ts and executes it
 *
 * Wraps execution in `withTraceId(...)` so log lines, db queries, and
 * downstream HTTP calls emitted from inside the job carry the same
 * trace id as the request (or a fresh one for cron-triggered runs).
 * `options.traceId` lets dispatchers attach a parent id explicitly;
 * absent that, we mint one of the form `job:<name>:<random>` so
 * background work is at least correlatable to itself.
 */
export async function runJob(name: string, options: { payload?: any; context?: any; traceId?: string } = {}): Promise<void> {
  const { withTraceId } = await import('@stacksjs/router')
  const traceId = options.traceId ?? `job:${name}:${Math.random().toString(36).slice(2, 10)}`

  await withTraceId(traceId, async () => {
    const jobPath = appPath(`Jobs/${name}.ts`)
    const jobModule = await import(jobPath)
    const jobConfig = jobModule.default

    if (!jobConfig) {
      throw new Error(`Job ${name} does not export a default`)
    }

    if (typeof jobConfig.handle === 'function') {
      await jobConfig.handle(options.payload)
    }
    else if (typeof jobConfig.action === 'string') {
      const { runAction } = await import('@stacksjs/actions')
      await runAction(jobConfig.action)
    }
    else if (typeof jobConfig.action === 'function') {
      await jobConfig.action()
    }
    else if (typeof jobConfig === 'function') {
      await jobConfig(options.payload, options.context)
    }
    else {
      throw new Error(`Job ${name} does not have a valid handler`)
    }
  })
}
