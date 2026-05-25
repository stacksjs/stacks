/**
 * Stacks Job Helper
 *
 * Simple helper for dispatching file-based jobs from app/Jobs/*.ts
 * For class-based jobs, use bun-queue's JobBase directly.
 */

import { appPath } from '@stacksjs/path'
import { env as envVars } from '@stacksjs/env'
import { createEnvelope } from './envelope'
import { hasDispatchedKey, recordDispatchedKey } from './idempotency'

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
  /**
   * Caller-supplied idempotency key (stacksjs/stacks#1872 Q-8).
   *
   * When set, `dispatch()` consults the `job_idempotency` dedup
   * table before enqueuing. A second dispatch with the same key
   * is a no-op — the framework returns without re-pushing to the
   * queue. Closes the duplicate-job loophole that double-clicked
   * buttons and webhook-retry loops opened.
   *
   * Construction guidance: derive the key from the business event
   * (e.g. `process-order:${orderId}`,
   * `send-welcome:${userId}`), not from job-name + payload (which
   * would collide across unrelated dispatches and prevent legitimate
   * re-runs).
   */
  idempotencyKey?: string
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
   * Attach an idempotency key so duplicate dispatches are
   * deduplicated against the `job_idempotency` table
   * (stacksjs/stacks#1872 Q-8). See {@link JobDispatchOptions.idempotencyKey}
   * for construction guidance.
   */
  withIdempotencyKey(key: string): this {
    this.options.idempotencyKey = key
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

    // Idempotency-key short-circuit (stacksjs/stacks#1872 Q-8). A
    // second dispatch under the same key returns without enqueuing.
    // The lookup degrades to "always miss" with a warn when the
    // dedup table isn't migrated yet — opt-in pattern matching
    // #1879 Co-3 (orders) and #1871 M-8 (email).
    if (this.options.idempotencyKey) {
      if (await hasDispatchedKey(this.options.idempotencyKey)) return
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
    else if (driver === 'sqs' || driver === 'memory' || driver === 'beanstalkd') {
      // Listed in config schemas but never implemented (stacksjs/stacks#1872 Q-1).
      // The previous fallback ran the job inline via `runJob` — same behavior
      // as `sync` but without telling the caller their background pipeline
      // had silently degraded to blocking sends. Loud-fail instead.
      throw new Error(
        `[queue] Driver "${driver}" is not implemented yet. `
        + `Set QUEUE_DRIVER to one of: redis, database, sync.`,
      )
    }
    else {
      // Genuinely unknown driver — also loud-fail. A typo in QUEUE_DRIVER
      // used to silently run jobs synchronously, which is the worst kind
      // of "it works on my machine" surprise.
      throw new Error(
        `[queue] Unknown QUEUE_DRIVER "${driver}". `
        + `Allowed values: redis, database, sync.`,
      )
    }

    // Record AFTER the driver dispatch succeeds so a failed enqueue
    // (driver down, schema mismatch) doesn't lock the key — the
    // caller can retry. Sync-driver dispatches are also recorded so
    // an at-most-once contract holds across drivers (a `sync` retry
    // with the same key shouldn't re-run either).
    if (this.options.idempotencyKey) {
      await recordDispatchedKey(this.options.idempotencyKey, this.name, this.options.queue)
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

    // Unified envelope (stacksjs/stacks#1884 Q-6). Both database
    // and redis drivers write through `createEnvelope` so a worker
    // processing one driver can deserialize jobs queued under the
    // other — fixes the silent in-flight job loss when teams
    // switch QUEUE_DRIVER mid-flight.
    const envelope = createEnvelope(this.name, this.payload, {
      queue: this.options.queue,
      timeout: this.options.timeout,
      tries: this.options.tries,
      backoff: this.options.backoff,
    })

    const { db } = await import('@stacksjs/database')

    await db
      .insertInto('jobs')
      .values({
        queue: this.options.queue || 'default',
        payload: JSON.stringify(envelope),
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
    // `queueConfig` is typed as `StacksOptions['queue']` already — the
    // previous `as any` cast (stacksjs/stacks#1875 T-6) escaped that
    // typing so a config-shape rename would silently break here.
    const redisConfig = queueConfig?.connections?.redis

    if (!redisConfig) {
      throw new Error('Redis queue connection is not configured. Check config/queue.ts')
    }

    const queue = new RedisQueue(this.options.queue || 'default', redisConfig)

    // Same envelope shape as the database driver writes
    // (stacksjs/stacks#1884 Q-6). bun-queue's `Queue.add(data, opts)`
    // takes `data` as opaque `T` — wrapping the framework envelope
    // inside is transparent to bun-queue. Options stay on bun-queue's
    // separate opts arg AND inside the envelope so a worker reading
    // the envelope sees the same retry/timeout/backoff config the
    // bun-queue layer is already enforcing.
    const envelope = createEnvelope(this.name, this.payload, {
      queue: this.options.queue,
      timeout: this.options.timeout,
      tries: this.options.tries,
      backoff: this.options.backoff,
    })

    await queue.add(
      envelope,
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

  /**
   * Dispatch with an idempotency key in one call
   * (stacksjs/stacks#1872 Q-8). Equivalent to
   * `Jobs.make(name, payload).withIdempotencyKey(key).dispatch()`.
   */
  async dispatchOnce(key: string, name: string, payload?: any): Promise<void> {
    await new JobBuilder(name, payload).withIdempotencyKey(key).dispatch()
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
