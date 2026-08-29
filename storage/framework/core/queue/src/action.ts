import type { JobOptions } from '@stacksjs/types'
import { env as envVars } from '@stacksjs/env'
import { assertEnvelopeSerializable, createEnvelope, serializeEnvelope } from './envelope'

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
/**
 * The payload argument list for a job.
 *
 * A job that declares what it takes must be given it; one that declares
 * nothing (`T` left as `unknown`) may still be dispatched bare, which is what
 * a job like `Inspire` does.
 */
export type JobPayloadArgs<T> = unknown extends T ? [payload?: T] : [payload: T]

export class Job<T = unknown> {
  name: JobOptions['name']
  description: JobOptions['description']
  action?: JobOptions['action']
  handle?: JobOptions<T>['handle']
  queue?: string
  rate: JobOptions['rate']
  tries: JobOptions['tries']
  timeout?: number
  backoff: JobOptions['backoff']
  backoffConfig: JobOptions['backoffConfig']
  enabled: JobOptions['enabled']

  constructor(options: JobOptions<T> & { queue?: string; timeout?: number }) {
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
  async dispatch(...[payload]: JobPayloadArgs<T>): Promise<void> {
    // Check if queue is faked (testing mode)
    const { isFaked, getFakeQueue } = await import('./testing')
    if (isFaked()) {
      getFakeQueue()?.dispatch(this.name || 'UnknownJob', payload, {
        queue: this.queue,
        tries: this.tries,
        timeout: this.timeout,
      })
      return
    }

    const driver = getQueueDriver()

    if (driver === 'sync') {
      return this.dispatchNow(...([payload] as JobPayloadArgs<T>))
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
  async dispatchIf(condition: boolean, ...[payload]: JobPayloadArgs<T>): Promise<void> {
    if (condition) {
      return this.dispatch(...([payload] as JobPayloadArgs<T>))
    }
  }

  /**
   * Dispatch unless the condition is true.
   */
  async dispatchUnless(condition: boolean, ...[payload]: JobPayloadArgs<T>): Promise<void> {
    if (!condition) {
      return this.dispatch(...([payload] as JobPayloadArgs<T>))
    }
  }

  /**
   * Dispatch with a delay (in seconds).
   */
  async dispatchAfter(delaySeconds: number, ...[payload]: JobPayloadArgs<T>): Promise<void> {
    const driver = getQueueDriver()

    if (driver === 'redis') {
      return this.dispatchToRedis(payload, { delay: delaySeconds })
    }

    if (driver === 'database') {
      return this.dispatchToDatabase(payload, { delay: delaySeconds })
    }

    // Sync: wait then execute
    await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000))
    return await this.dispatchNow(...([payload] as JobPayloadArgs<T>))
  }

  /**
   * Execute the job immediately, bypassing the queue.
   */
  async dispatchNow(...[payload]: JobPayloadArgs<T>): Promise<void> {
    if (typeof this.handle === 'function') {
      await this.handle(payload as T)
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

    /*
     * Serialized through the guard, and before the database module is even
     * loaded (stacksjs/stacks#2282 item 6).
     *
     * This is the dispatch path `docs/basics/jobs.md` teaches — `new Job({...})`
     * in `app/Jobs/*.ts`, then `.dispatch(payload)` — so it is the one most
     * payloads actually travel down, and it was the one still calling
     * `JSON.stringify` by hand. A BigInt anywhere in the payload threw from
     * inside JSON, naming neither the job nor the property, with a connection
     * already taken for a row that was never going to be written. See the
     * round-trip contract in ./envelope for what else JSON costs a payload —
     * `undefined` dropped, `Date` flattened to a string.
     */
    const payloadJson = serializeEnvelope(envelope)

    const { db } = await import('@stacksjs/database')

    await db
      .insertInto('jobs')
      .values({
        queue: this.queue || 'default',
        payload: payloadJson,
        attempts: 0,
        reserved_at: null,
        available_at: availableAt,
        created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
      })
      .execute()
  }

  private async dispatchToRedis(payload?: any, opts?: { delay?: number }): Promise<void> {
    // Same envelope as the database path (stacksjs/stacks#1884 Q-6) —
    // bun-queue takes the envelope as opaque data; the worker side
    // parses through `parseEnvelope` regardless of driver.
    const envelope = createEnvelope(this.name ?? this.constructor.name, payload, {
      queue: this.queue ?? 'default',
      tries: typeof this.tries === 'number' ? this.tries : undefined,
      timeout: this.timeout,
      backoff: Array.isArray(this.backoff) ? this.backoff : undefined,
    })

    /*
     * Built and checked first — before the driver module is loaded, before the
     * config is read, and so before a socket is opened
     * (stacksjs/stacks#2282 item 6). bun-queue stringifies `data` itself
     * several layers down, so an unserializable payload surfaced there as the
     * bare TypeError this replaces: no job name, no property, and a live Redis
     * connection held for a job that could never be enqueued.
     */
    assertEnvelopeSerializable(envelope)

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
