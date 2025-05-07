import type { Dispatchable, QueueOption } from '@stacksjs/types'
import process from 'node:process'
import { runAction } from '@stacksjs/actions'
import { log } from '@stacksjs/cli'
import { appPath } from '@stacksjs/path'
import { storeJob } from './utils'

const queueDriver = 'database'

interface JobConfig {
  handle?: (payload?: any) => Promise<void>
  action?: string | (() => Promise<void>)
}

export async function runJob(name: string, options: QueueOption = {}): Promise<void> {
  const jobModule = await import(appPath(`Jobs/${name}.ts`))
  const job = jobModule.default as JobConfig

  if (options.payload) {
    // Attach payload to the job instance if it exists
    Object.assign(job, { payload: options.payload })
  }

  if (options.context) {
    // Attach context to the job instance if it exists
    Object.assign(job, { context: options.context })
  }

  if (job.action) {
    // If action is a string, run it via runAction
    if (typeof job.action === 'string') {
      await runAction(job.action)
    }
    // If action is a function, execute it directly
    else if (typeof job.action === 'function') {
      await job.action()
    }
  }
  // If handle is defined, execute it
  else if (job.handle) {
    await job.handle(options.payload)
  }
  // If no handle or action, try to execute the module directly
  else if (typeof jobModule.default === 'function') {
    await jobModule.default(options.payload, options.context)
  }
  else {
    // Try to execute the file itself if it exports a function
    const possibleFunction = Object.values(jobModule).find(exp => typeof exp === 'function')
    if (possibleFunction) {
      await possibleFunction(options.payload, options.context)
    }
    else {
      throw new Error(`Job ${name} must export a function, or define either a handle function or an action`)
    }
  }
}

export class Queue implements Dispatchable {
  protected options: QueueOption = {}

  constructor(
    protected name: string,
    protected payload?: any,
  ) { }

  async dispatch(): Promise<void> {
    const queueName = this.options.queue || 'default'

    const jobPayload = this.createJobPayload(queueName)

    if (this.isQueuedDriver()) {
      await this.storeQueuedJob(jobPayload)
      return
    }

    if (this.options.afterResponse) {
      this.deferAfterResponse()
      return
    }

    if (this.options.delay) {
      this.deferWithDelay()
      return
    }

    await this.runJobImmediately(jobPayload)
  }

  private isQueuedDriver(): boolean {
    return ['database', 'redis'].includes(queueDriver)
  }

  private createJobPayload(queueName: string): QueueOption {
    return {
      queue: queueName,
      payload: this.payload,
      context: this.options.context,
      maxTries: this.options.maxTries,
      timeout: this.options.timeout,
      backoff: this.options.backoff,
      delay: this.options.delay,
    }
  }

  private async storeQueuedJob(jobPayload: any): Promise<void> {
    await storeJob(this.name, jobPayload)
  }

  private deferAfterResponse(): void {
    process.on('beforeExit', async () => {
      await this.dispatchNow()
    })
  }

  private deferWithDelay(): void {
    setTimeout(async () => {
      await this.dispatchNow()
    }, this.options.delay || 0)
  }

  private async runJobImmediately(jobPayload: any): Promise<void> {
    try {
      await runJob(this.name, jobPayload)
      await this.runChainedJobs()
    }
    catch (error) {
      log.error(`Failed to dispatch job ${this.name}:`, error)
      throw error
    }
  }

  private async runChainedJobs(): Promise<void> {
    if (!this.options.chainedJobs?.length)
      return

    for (const job of this.options.chainedJobs) {
      await job.dispatch()
    }
  }

  async dispatchNow(): Promise<void> {
    try {
      await runJob(this.name, {
        payload: this.payload,
        context: this.options.context,
        immediate: true,
      })

      if (this.options.chainedJobs?.length) {
        for (const job of this.options.chainedJobs) {
          await job.dispatchNow()
        }
      }
    }
    catch (error) {
      log.error(`Failed to execute job ${this.name}:`, error)
      throw error
    }
  }

  delay(seconds: number): this {
    this.options.delay = seconds
    return this
  }

  onQueue(queue: string): this {
    this.options.queue = queue
    return this
  }

  chain(jobs: Dispatchable[]): this {
    this.options.chainedJobs = jobs
    return this
  }

  afterResponse(): this {
    this.options.afterResponse = true
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

  withContext(context: any): this {
    this.options.context = context
    return this
  }
}

export class JobFactory {
  static make(name: string, payload?: any): Queue {
    return new Queue(name, payload)
  }

  static dispatch(name: string, payload?: any): Queue {
    const job = new Queue(name, payload)
    job.dispatch()
    return job
  }

  static async dispatchNow(name: string, payload?: any): Promise<void> {
    await new Queue(name, payload).dispatchNow()
  }

  static later(delay: number, name: string, payload?: any): Queue {
    return new Queue(name, payload).delay(delay)
  }

  static chain(jobs: Queue[]): Queue {
    const firstJob = jobs[0]
    return firstJob.chain(jobs.slice(1))
  }
}

export function job(name: string, payload?: any): Queue {
  return JobFactory.make(name, payload)
}

// Example job file structures:
/*
// 1. Using handle method
export default {
  async handle(payload) {
    // Job logic here
    // payload contains the data passed when dispatching the job
  }
}

// 2. Using action string
export default {
  action: 'SendWelcomeEmail' // References an action in your actions directory
}

// 3. Using action function
export default {
  action: async () => {
    // Job logic here
  }
}

// 4. Direct function export
export default async function(payload, context) {
  // Job logic here
  // payload contains the data passed when dispatching the job
  // context contains additional context passed via withContext()
}

// 5. Named export
export async function processOrder(payload, context) {
  // Job logic here
  // payload contains the data passed when dispatching the job
  // context contains additional context passed via withContext()
}

// Usage examples:

// Basic job dispatch
await job('SendWelcomeEmail', { user: { id: 1, email: 'user@example.com' } })
  .onQueue('emails')
  .dispatch()

// Job with retry configuration
await job('ProcessOrder', { orderId: 123 })
  .withContext({ priority: 'high' })
  .tries(3)
  .backoff([10, 30, 60]) // Retry after 10s, 30s, then 60s
  .dispatch()

// Delayed job
await job('SendReminder', { userId: 1 })
  .delay(3600) // Delay by 1 hour
  .dispatch()

// Job that runs after response
await job('CleanupTempFiles')
  .afterResponse()
  .dispatch()

// Chained jobs
const firstJob = job('ProcessPayment', { amount: 100 })
const secondJob = job('SendReceipt', { email: 'user@example.com' })
const thirdJob = job('UpdateInventory', { productId: 456 })

await firstJob
  .chain([secondJob, thirdJob])
  .dispatch()

// Immediate execution
await job('ProcessOrder', { orderId: 123 })
  .dispatchNow()
*/
