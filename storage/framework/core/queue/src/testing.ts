/**
 * Queue Testing Utilities for Stacks
 *
 * Provides helpers for testing jobs and queue operations.
 */

import type { JobOptions } from '@stacksjs/types'

/**
 * Dispatched job record for assertions
 */
export interface DispatchedJob<T = any> {
  name: string
  data: T
  options: Partial<JobOptions>
  dispatchedAt: Date
  queue: string
}

/**
 * Fake queue for testing
 */
class FakeQueue {
  private dispatchedJobs: DispatchedJob[] = []
  private pushedJobs: DispatchedJob[] = []
  private processedJobs: DispatchedJob[] = []
  private failedJobs: Array<{ job: DispatchedJob, error: Error }> = []

  /**
   * Record a dispatched job
   */
  dispatch<T>(name: string, data: T, options: Partial<JobOptions> = {}): void {
    this.dispatchedJobs.push({
      name,
      data,
      options,
      dispatchedAt: new Date(),
      queue: options.queue || 'default',
    })
  }

  /**
   * Record a pushed job (for delayed jobs)
   */
  push<T>(name: string, data: T, options: Partial<JobOptions> = {}): void {
    this.pushedJobs.push({
      name,
      data,
      options,
      dispatchedAt: new Date(),
      queue: options.queue || 'default',
    })
  }

  /**
   * Get all dispatched jobs
   */
  dispatched(name?: string): DispatchedJob[] {
    if (name) {
      return this.dispatchedJobs.filter(j => j.name === name)
    }
    return [...this.dispatchedJobs]
  }

  /**
   * Get all pushed jobs
   */
  pushed(name?: string): DispatchedJob[] {
    if (name) {
      return this.pushedJobs.filter(j => j.name === name)
    }
    return [...this.pushedJobs]
  }

  /**
   * Check if a job was dispatched
   */
  assertDispatched(name: string, callback?: (job: DispatchedJob) => boolean): void {
    const jobs = this.dispatched(name)

    if (jobs.length === 0) {
      throw new Error(`Expected job "${name}" to be dispatched, but it was not.`)
    }

    if (callback) {
      const matching = jobs.filter(callback)
      if (matching.length === 0) {
        throw new Error(`Expected job "${name}" to be dispatched matching the callback, but no matching jobs were found.`)
      }
    }
  }

  /**
   * Check if a job was not dispatched
   */
  assertNotDispatched(name: string): void {
    const jobs = this.dispatched(name)

    if (jobs.length > 0) {
      throw new Error(`Expected job "${name}" to not be dispatched, but it was dispatched ${jobs.length} time(s).`)
    }
  }

  /**
   * Check dispatched count
   */
  assertDispatchedTimes(name: string, times: number): void {
    const jobs = this.dispatched(name)

    if (jobs.length !== times) {
      throw new Error(`Expected job "${name}" to be dispatched ${times} time(s), but it was dispatched ${jobs.length} time(s).`)
    }
  }

  /**
   * Check if nothing was dispatched
   */
  assertNothingDispatched(): void {
    if (this.dispatchedJobs.length > 0) {
      const names = [...new Set(this.dispatchedJobs.map(j => j.name))].join(', ')
      throw new Error(`Expected no jobs to be dispatched, but found: ${names}`)
    }
  }

  /**
   * Check if a job was pushed (delayed)
   */
  assertPushed(name: string, callback?: (job: DispatchedJob) => boolean): void {
    const jobs = this.pushed(name)

    if (jobs.length === 0) {
      throw new Error(`Expected job "${name}" to be pushed, but it was not.`)
    }

    if (callback) {
      const matching = jobs.filter(callback)
      if (matching.length === 0) {
        throw new Error(`Expected job "${name}" to be pushed matching the callback, but no matching jobs were found.`)
      }
    }
  }

  /**
   * Check if a job was pushed with delay
   */
  assertPushedWithDelay(name: string, delay: number): void {
    const jobs = this.pushed(name)
    const matching = jobs.filter(j => j.options.delay === delay)

    if (matching.length === 0) {
      throw new Error(`Expected job "${name}" to be pushed with delay ${delay}ms, but no matching jobs were found.`)
    }
  }

  /**
   * Check if a job was pushed on a specific queue
   */
  assertPushedOn(queue: string, name: string): void {
    const jobs = this.pushed(name).filter(j => j.queue === queue)

    if (jobs.length === 0) {
      throw new Error(`Expected job "${name}" to be pushed on queue "${queue}", but it was not.`)
    }
  }

  /**
   * Simulate processing a job
   */
  async processJob<T>(name: string, handler: (data: T) => Promise<any>): Promise<void> {
    const job = this.dispatchedJobs.find(j => j.name === name)
    if (!job) {
      throw new Error(`No dispatched job found with name "${name}"`)
    }

    try {
      await handler(job.data)
      this.processedJobs.push(job)
    }
    catch (error) {
      this.failedJobs.push({ job, error: error as Error })
      throw error
    }
  }

  /**
   * Get processed jobs
   */
  processed(name?: string): DispatchedJob[] {
    if (name) {
      return this.processedJobs.filter(j => j.name === name)
    }
    return [...this.processedJobs]
  }

  /**
   * Get failed jobs
   */
  failed(name?: string): Array<{ job: DispatchedJob, error: Error }> {
    if (name) {
      return this.failedJobs.filter(f => f.job.name === name)
    }
    return [...this.failedJobs]
  }

  /**
   * Reset all recorded jobs
   */
  reset(): void {
    this.dispatchedJobs = []
    this.pushedJobs = []
    this.processedJobs = []
    this.failedJobs = []
  }
}

// Global fake queue instance
let fakeQueue: FakeQueue | null = null

/**
 * Enable fake queue for testing
 */
export function fake(): FakeQueue {
  fakeQueue = new FakeQueue()
  return fakeQueue
}

/**
 * Get the fake queue instance
 */
export function getFakeQueue(): FakeQueue | null {
  return fakeQueue
}

/**
 * Check if queue is faked
 */
export function isFaked(): boolean {
  return fakeQueue !== null
}

/**
 * Restore real queue behavior
 */
export function restore(): void {
  fakeQueue = null
}

/**
 * Queue testing helper class
 */
export class QueueTester {
  private readonly queue: FakeQueue

  constructor() {
    this.queue = fake()
  }

  /**
   * Dispatch a job for testing
   */
  dispatch<T>(name: string, data: T, options: Partial<JobOptions> = {}): this {
    this.queue.dispatch(name, data, options)
    return this
  }

  /**
   * Push a delayed job for testing
   */
  push<T>(name: string, data: T, options: Partial<JobOptions> = {}): this {
    this.queue.push(name, data, options)
    return this
  }

  /**
   * Assert a job was dispatched
   */
  assertDispatched(name: string, callback?: (job: DispatchedJob) => boolean): this {
    this.queue.assertDispatched(name, callback)
    return this
  }

  /**
   * Assert a job was not dispatched
   */
  assertNotDispatched(name: string): this {
    this.queue.assertNotDispatched(name)
    return this
  }

  /**
   * Assert dispatched count
   */
  assertDispatchedTimes(name: string, times: number): this {
    this.queue.assertDispatchedTimes(name, times)
    return this
  }

  /**
   * Assert nothing was dispatched
   */
  assertNothingDispatched(): this {
    this.queue.assertNothingDispatched()
    return this
  }

  /**
   * Get dispatched jobs
   */
  dispatched(name?: string): DispatchedJob[] {
    return this.queue.dispatched(name)
  }

  /**
   * Reset the queue
   */
  reset(): this {
    this.queue.reset()
    return this
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    restore()
  }
}

/**
 * Create a queue tester instance
 */
export function createQueueTester(): QueueTester {
  return new QueueTester()
}

/**
 * Test helper to run a job synchronously
 */
export async function runJob<T, R>(
  jobModule: { handle: (data: T) => Promise<R> | R },
  data: T,
): Promise<R> {
  return await jobModule.handle(data)
}

/**
 * Test helper to expect a job to fail
 */
export async function expectJobToFail<T>(
  jobModule: { handle: (data: T) => Promise<any> },
  data: T,
  expectedError?: string | RegExp,
): Promise<Error> {
  try {
    await jobModule.handle(data)
    throw new Error('Expected job to fail, but it succeeded')
  }
  catch (error) {
    if ((error as Error).message === 'Expected job to fail, but it succeeded') {
      throw error
    }

    if (expectedError) {
      const message = (error as Error).message
      if (typeof expectedError === 'string') {
        if (!message.includes(expectedError)) {
          throw new Error(`Expected error to contain "${expectedError}", got "${message}"`)
        }
      }
      else if (!expectedError.test(message)) {
        throw new Error(`Expected error to match ${expectedError}, got "${message}"`)
      }
    }

    return error as Error
  }
}
