import type { JobOptions } from '@stacksjs/types'
import { env as envVars } from '@stacksjs/env'
import { createEnvelope } from './envelope'

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
   *
   * The payload is generic so callers get compile-time checking when
   * the job declares its expected shape — e.g. `JobAction<{ userId: number }>`
   * rejects `dispatch({ usrId: 1 })` at the type level. Defaults to
   * `unknown` (not `any`) so dispatchers that DON'T set a generic still
   * force callers to narrow before reading properties off the
   * downstream handler. (stacksjs/stacks#1872 Q-9.)
   */
  async dispatch<T = unknown>(payload?: T): Promise<void> {
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

    // Stubbed-but-advertised drivers OR unknown driver — loud-fail
    // instead of silently degrading to inline sync (stacksjs/stacks#1872 Q-1).
    if (driver === 'sqs' || driver === 'memory' || driver === 'beanstalkd') {
      throw new Error(
        `[queue] Driver "${driver}" is not implemented yet. `
        + `Set QUEUE_DRIVER to one of: redis, database, sync.`,
      )
    }
    throw new Error(
      `[queue] Unknown QUEUE_DRIVER "${driver}". `
      + `Allowed values: redis, database, sync.`,
    )
  }

  /**
   * Dispatch only if the condition is true.
   */
  async dispatchIf<T = unknown>(condition: boolean, payload?: T): Promise<void> {
    if (condition) {
      return this.dispatch(payload)
    }
  }

  /**
   * Dispatch unless the condition is true.
   */
  async dispatchUnless<T = unknown>(condition: boolean, payload?: T): Promise<void> {
    if (!condition) {
      return this.dispatch(payload)
    }
  }

  /**
   * Dispatch with a delay (in seconds).
   */
  async dispatchAfter<T = unknown>(delaySeconds: number, payload?: T): Promise<void> {
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
  async dispatchNow<T = unknown>(payload?: T): Promise<void> {
    if (typeof this.handle === 'function') {
      await this.handle(payload)
    }
    else if (typeof this.action === 'string') {
      const { runAction } = await import('@stacksjs/actions')
      await runAction(this.action)
    }
    else if (typeof this.action === 'function') {
      await (this.action as () => unknown | Promise<unknown>)()
    }
    else {
      throw new Error(`Job ${this.name} does not have a valid handler`)
    }
  }

  private async dispatchToDatabase(payload?: any, opts?: { delay?: number }): Promise<void> {
    const now = Math.floor(Date.now() / 1000)
    const availableAt = opts?.delay ? now + opts.delay : now

    // Unified envelope (stacksjs/stacks#1884 Q-6) — see job.ts for
    // the full rationale.
    const envelope = createEnvelope(this.name ?? this.constructor.name, payload, {
      queue: this.queue ?? 'default',
      tries: typeof this.tries === 'number' ? this.tries : undefined,
      timeout: this.timeout,
      backoff: Array.isArray(this.backoff) ? this.backoff : undefined,
    })

    const { db } = await import('@stacksjs/database')

    await db
      .insertInto('jobs')
      .values({
        queue: this.queue || 'default',
        payload: JSON.stringify(envelope),
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
    // Typed end-to-end via `StacksOptions['queue']` —
    // stacksjs/stacks#1875 T-6 dropped the `as any` cast that
    // escaped that typing.
    const redisConfig = queueConfig?.connections?.redis

    if (!redisConfig) {
      throw new Error('Redis queue connection is not configured. Check config/queue.ts')
    }

    const queue = new RedisQueue(this.queue || 'default', redisConfig as ConstructorParameters<typeof RedisQueue>[1])

    // Same envelope as the database path (stacksjs/stacks#1884 Q-6) —
    // bun-queue takes the envelope as opaque data; the worker side
    // parses through `parseEnvelope` regardless of driver.
    const envelope = createEnvelope(this.name ?? this.constructor.name, payload, {
      queue: this.queue ?? 'default',
      tries: typeof this.tries === 'number' ? this.tries : undefined,
      timeout: this.timeout,
      backoff: Array.isArray(this.backoff) ? this.backoff : undefined,
    })

    await queue.add(
      envelope,
      {
        delay: opts?.delay,
        maxTries: typeof this.tries === 'number' ? this.tries : undefined,
        timeout: this.timeout,
        backoff: Array.isArray(this.backoff) ? this.backoff : undefined,
      },
    )
  }
}
