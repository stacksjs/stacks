/**
 * Stacks Job Helper
 *
 * Simple helper for dispatching file-based jobs from app/Jobs/*.ts
 * For class-based jobs, use bun-queue's JobBase directly.
 */

import { appPath } from '@stacksjs/path'
import process from 'node:process'

// Environment variables
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
    const driver = getQueueDriver()

    if (driver === 'database') {
      // Queue to database
      await this.dispatchToDatabase()
    }
    else if (driver === 'sync') {
      // Run immediately (sync driver)
      await runJob(this.name, { payload: this.payload, context: this.options.context })
    }
    else {
      // Default to sync for unsupported drivers
      console.warn(`[JobBuilder] Unsupported queue driver: ${driver}, falling back to sync`)
      await runJob(this.name, { payload: this.payload, context: this.options.context })
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

    const payload = JSON.stringify(payloadObj)
    const queue = this.options.queue || 'default'
    const createdAt = new Date().toISOString().slice(0, 19).replace('T', ' ')

    // Use the configured database driver
    const { db } = await import('@stacksjs/database')

    await db
      .insertInto('jobs')
      .values({
        queue,
        payload,
        attempts: 0,
        reserved_at: null,
        available_at: availableAt,
        created_at: createdAt,
      })
      .execute()
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
 * Run a job immediately by name
 *
 * This loads the job from app/Jobs/{name}.ts and executes it
 */
export async function runJob(name: string, options: { payload?: any; context?: any } = {}): Promise<void> {
  // Load the job module from app/Jobs
  const jobPath = appPath(`Jobs/${name}.ts`)
  const jobModule = await import(jobPath)
  const jobConfig = jobModule.default

  if (!jobConfig) {
    throw new Error(`Job ${name} does not export a default`)
  }

  // Execute based on job type
  if (typeof jobConfig.handle === 'function') {
    // Function-based job with handle method
    await jobConfig.handle(options.payload)
  }
  else if (typeof jobConfig.action === 'string') {
    // Action-based job
    const { runAction } = await import('@stacksjs/actions')
    await runAction(jobConfig.action)
  }
  else if (typeof jobConfig.action === 'function') {
    // Function action
    await jobConfig.action()
  }
  else if (typeof jobConfig === 'function') {
    // Direct function export
    await jobConfig(options.payload, options.context)
  }
  else {
    throw new Error(`Job ${name} does not have a valid handler`)
  }
}
