/**
 * Stacks Job Helper
 *
 * Simple helper for dispatching file-based jobs from app/Jobs/*.ts
 * For class-based jobs, use bun-queue's JobBase directly.
 */

import { appPath } from '@stacksjs/path'

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
  ) {
    console.log(`[JobBuilder] Created for job: ${name}`, { payload })
  }

  /**
   * Set the queue name
   */
  onQueue(queue: string): this {
    console.log(`[JobBuilder] Setting queue: ${queue}`)
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
    console.log(`[JobBuilder] dispatch() called for: ${this.name}`)
    console.log(`[JobBuilder] Options:`, this.options)
    console.log(`[JobBuilder] Payload:`, this.payload)
    console.log(`[JobBuilder] About to call runJob()...`)

    // For now, run synchronously (sync driver behavior)
    // When bun-queue is properly configured with Redis, this will use the real queue
    await runJob(this.name, { payload: this.payload, context: this.options.context })

    console.log(`[JobBuilder] runJob() completed successfully`)
  }

  /**
   * Dispatch the job synchronously (immediate execution)
   */
  async dispatchNow(): Promise<void> {
    console.log(`[JobBuilder] dispatchNow() called for: ${this.name}`)
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
  console.log(`[runJob] Starting job: ${name}`)
  console.log(`[runJob] Options:`, options)

  try {
    // Load the job module from app/Jobs
    const jobPath = appPath(`Jobs/${name}.ts`)
    console.log(`[runJob] Loading job from: ${jobPath}`)

    const jobModule = await import(jobPath)
    console.log(`[runJob] Job module loaded:`, Object.keys(jobModule))

    const jobConfig = jobModule.default
    console.log(`[runJob] Job config:`, {
      name: jobConfig?.name,
      hasHandle: typeof jobConfig?.handle === 'function',
      hasAction: !!jobConfig?.action,
    })

    if (!jobConfig) {
      throw new Error(`Job ${name} does not export a default`)
    }

    // Execute based on job type
    if (typeof jobConfig.handle === 'function') {
      console.log(`[runJob] Executing handle() with payload:`, options.payload)
      // Function-based job with handle method
      await jobConfig.handle(options.payload)
      console.log(`[runJob] handle() completed`)
    }
    else if (typeof jobConfig.action === 'string') {
      console.log(`[runJob] Executing action: ${jobConfig.action}`)
      // Action-based job
      const { runAction } = await import('@stacksjs/actions')
      await runAction(jobConfig.action)
    }
    else if (typeof jobConfig.action === 'function') {
      console.log(`[runJob] Executing action function`)
      // Function action
      await jobConfig.action()
    }
    else if (typeof jobConfig === 'function') {
      console.log(`[runJob] Executing direct function`)
      // Direct function export
      await jobConfig(options.payload, options.context)
    }
    else {
      throw new Error(`Job ${name} does not have a valid handler`)
    }

    console.log(`[runJob] Job ${name} completed successfully!`)
  }
  catch (error) {
    console.error(`[runJob] Job ${name} failed:`, error)
    throw error
  }
}
