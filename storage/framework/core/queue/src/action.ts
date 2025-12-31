import type { JobOptions } from '@stacksjs/types'

/**
 * Stacks Job class for file-based jobs
 *
 * Use this for defining jobs in app/Jobs/*.ts files.
 * For class-based jobs, use bun-queue's JobBase directly.
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
}
