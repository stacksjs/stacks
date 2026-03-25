import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import {
  job,
  toJobOptions,
  fake,
  isFaked,
  restore,
  getFakeQueue,
  getRegisteredJobs,
  createQueueTester,
  QueueTester,
  expectJobToFail,
} from '../src'
import type { DiscoveredJob } from '../src'

// ============================================================================
// Job Builder - Real fluent API
// ============================================================================

describe('Queue - Job Builder', () => {
  test('job() creates a JobBuilder with dispatch methods', () => {
    const builder = job('SendEmail', { to: 'test@example.com' })
    expect(builder).toBeDefined()
    expect(typeof builder.onQueue).toBe('function')
    expect(typeof builder.delay).toBe('function')
    expect(typeof builder.tries).toBe('function')
    expect(typeof builder.timeout).toBe('function')
    expect(typeof builder.backoff).toBe('function')
    expect(typeof builder.withContext).toBe('function')
    expect(typeof builder.dispatch).toBe('function')
    expect(typeof builder.dispatchNow).toBe('function')
    expect(typeof builder.dispatchIf).toBe('function')
    expect(typeof builder.dispatchUnless).toBe('function')
  })

  test('job() with no payload still creates a builder', () => {
    const builder = job('CleanupJob')
    expect(builder).toBeDefined()
    expect(typeof builder.dispatch).toBe('function')
  })

  test('JobBuilder chains fluently', () => {
    const builder = job('ProcessPayment', { amount: 100 })
      .onQueue('payments')
      .delay(30)
      .tries(3)
      .timeout(120)
      .backoff([10, 30, 60])

    expect(builder).toBeDefined()
    // Each method returns `this` for chaining
    expect(typeof builder.dispatch).toBe('function')
  })

  test('JobBuilder.withContext adds context', () => {
    const builder = job('SendNotification', { message: 'Hello' })
      .withContext({ userId: 42 })

    expect(builder).toBeDefined()
    expect(typeof builder.dispatch).toBe('function')
  })
})

// ============================================================================
// toJobOptions - Real conversion logic
// ============================================================================

describe('Queue - toJobOptions', () => {
  test('toJobOptions converts DiscoveredJob config to JobOptions', () => {
    const discoveredJob: DiscoveredJob = {
      name: 'TestJob',
      path: '/app/Jobs/TestJob.ts',
      config: {
        name: 'TestJob',
        queue: 'default',
        tries: 3,
        backoff: 60,
        timeout: 300,
        rate: '*/5 * * * *',
      },
      type: 'function',
      module: {},
    }

    const opts = toJobOptions(discoveredJob)
    expect(opts).toBeDefined()
    expect(opts.name).toBe('TestJob')
    expect(opts.queue).toBe('default')
    expect(opts.tries).toBe(3)
    expect(opts.backoff).toBe(60)
    expect(opts.timeout).toBe(300)
    expect(opts.rate).toBe('*/5 * * * *')
  })

  test('toJobOptions handles minimal config', () => {
    const discoveredJob: DiscoveredJob = {
      name: 'MinimalJob',
      path: '/app/Jobs/MinimalJob.ts',
      config: {
        name: 'MinimalJob',
      },
      type: 'function',
      module: {},
    }

    const opts = toJobOptions(discoveredJob)
    expect(opts).toBeDefined()
    expect(opts.name).toBe('MinimalJob')
    expect(opts.queue).toBeUndefined()
    expect(opts.tries).toBeUndefined()
  })

  test('toJobOptions preserves backoffConfig', () => {
    const discoveredJob: DiscoveredJob = {
      name: 'BackoffJob',
      path: '/app/Jobs/BackoffJob.ts',
      config: {
        name: 'BackoffJob',
        backoffConfig: {
          strategy: 'exponential',
          initialDelay: 1000,
          factor: 2,
          maxDelay: 60000,
        },
      },
      type: 'function',
      module: {},
    }

    const opts = toJobOptions(discoveredJob)
    expect(opts.backoffConfig).toBeDefined()
  })
})

// ============================================================================
// Fake Queue - Real testing utilities
// ============================================================================

describe('Queue - Fake Queue Testing', () => {
  afterEach(() => {
    restore()
  })

  test('fake() enables test mode and returns a FakeQueue', () => {
    const fakeQueue = fake()
    expect(fakeQueue).toBeDefined()
    expect(isFaked()).toBe(true)
  })

  test('restore() disables test mode', () => {
    fake()
    expect(isFaked()).toBe(true)
    restore()
    expect(isFaked()).toBe(false)
  })

  test('getFakeQueue returns the FakeQueue instance after fake()', () => {
    fake()
    const queue = getFakeQueue()
    expect(queue).toBeDefined()
    expect(queue).not.toBeNull()
  })

  test('getFakeQueue returns null when not faked', () => {
    const queue = getFakeQueue()
    expect(queue).toBeNull()
  })

  test('FakeQueue records dispatched jobs', () => {
    const fakeQueue = fake()
    fakeQueue.dispatch('SendEmail', { to: 'user@example.com' })
    fakeQueue.dispatch('ProcessOrder', { orderId: 123 })

    const dispatched = fakeQueue.dispatched()
    expect(dispatched).toHaveLength(2)
    expect(dispatched[0].name).toBe('SendEmail')
    expect(dispatched[0].data).toEqual({ to: 'user@example.com' })
    expect(dispatched[1].name).toBe('ProcessOrder')
    expect(dispatched[1].data).toEqual({ orderId: 123 })
  })

  test('FakeQueue.dispatched() filters by name', () => {
    const fakeQueue = fake()
    fakeQueue.dispatch('SendEmail', { to: 'a@b.com' })
    fakeQueue.dispatch('ProcessOrder', { orderId: 1 })
    fakeQueue.dispatch('SendEmail', { to: 'c@d.com' })

    const emails = fakeQueue.dispatched('SendEmail')
    expect(emails).toHaveLength(2)
    expect(emails[0].data).toEqual({ to: 'a@b.com' })
    expect(emails[1].data).toEqual({ to: 'c@d.com' })

    const orders = fakeQueue.dispatched('ProcessOrder')
    expect(orders).toHaveLength(1)
  })

  test('FakeQueue.assertDispatched verifies job was dispatched', () => {
    const fakeQueue = fake()
    fakeQueue.dispatch('SendEmail', { to: 'test@test.com' })

    // Should not throw
    expect(() => fakeQueue.assertDispatched('SendEmail')).not.toThrow()
  })

  test('FakeQueue.assertDispatched throws if not dispatched', () => {
    fake()
    const fakeQueue = getFakeQueue()!

    expect(() => fakeQueue.assertDispatched('NonexistentJob')).toThrow()
  })

  test('FakeQueue.assertNotDispatched verifies job was not dispatched', () => {
    const fakeQueue = fake()
    fakeQueue.dispatch('SendEmail', { to: 'test@test.com' })

    expect(() => fakeQueue.assertNotDispatched('ProcessOrder')).not.toThrow()
    expect(() => fakeQueue.assertNotDispatched('SendEmail')).toThrow()
  })

  test('FakeQueue.assertDispatchedTimes verifies exact count', () => {
    const fakeQueue = fake()
    fakeQueue.dispatch('SendEmail', {})
    fakeQueue.dispatch('SendEmail', {})

    expect(() => fakeQueue.assertDispatchedTimes('SendEmail', 2)).not.toThrow()
    expect(() => fakeQueue.assertDispatchedTimes('SendEmail', 1)).toThrow()
    expect(() => fakeQueue.assertDispatchedTimes('SendEmail', 3)).toThrow()
  })

  test('FakeQueue.assertNothingDispatched passes when empty', () => {
    const fakeQueue = fake()
    expect(() => fakeQueue.assertNothingDispatched()).not.toThrow()
  })

  test('FakeQueue.assertNothingDispatched throws when jobs exist', () => {
    const fakeQueue = fake()
    fakeQueue.dispatch('SomeJob', {})
    expect(() => fakeQueue.assertNothingDispatched()).toThrow()
  })

  test('FakeQueue.push records delayed jobs', () => {
    const fakeQueue = fake()
    fakeQueue.push('DelayedJob', { data: 1 }, { delay: 5000 } as any)

    const pushed = fakeQueue.pushed()
    expect(pushed).toHaveLength(1)
    expect(pushed[0].name).toBe('DelayedJob')
  })

  test('FakeQueue.assertPushed verifies pushed jobs', () => {
    const fakeQueue = fake()
    fakeQueue.push('DelayedJob', { data: 1 })

    expect(() => fakeQueue.assertPushed('DelayedJob')).not.toThrow()
    expect(() => fakeQueue.assertPushed('NonexistentJob')).toThrow()
  })

  test('FakeQueue.assertDispatched with callback filter', () => {
    const fakeQueue = fake()
    fakeQueue.dispatch('SendEmail', { to: 'admin@test.com', priority: 'high' })
    fakeQueue.dispatch('SendEmail', { to: 'user@test.com', priority: 'low' })

    expect(() => {
      fakeQueue.assertDispatched('SendEmail', (j) => j.data.priority === 'high')
    }).not.toThrow()

    expect(() => {
      fakeQueue.assertDispatched('SendEmail', (j) => j.data.priority === 'urgent')
    }).toThrow()
  })

  test('FakeQueue default queue is "default"', () => {
    const fakeQueue = fake()
    fakeQueue.dispatch('TestJob', { x: 1 })

    const dispatched = fakeQueue.dispatched()
    expect(dispatched[0].queue).toBe('default')
  })

  test('FakeQueue respects queue option', () => {
    const fakeQueue = fake()
    fakeQueue.dispatch('TestJob', { x: 1 }, { queue: 'priority' } as any)

    const dispatched = fakeQueue.dispatched()
    expect(dispatched[0].queue).toBe('priority')
  })

  test('FakeQueue records dispatchedAt timestamp', () => {
    const before = new Date()
    const fakeQueue = fake()
    fakeQueue.dispatch('TestJob', {})
    const after = new Date()

    const dispatched = fakeQueue.dispatched()
    expect(dispatched[0].dispatchedAt).toBeInstanceOf(Date)
    expect(dispatched[0].dispatchedAt.getTime()).toBeGreaterThanOrEqual(before.getTime())
    expect(dispatched[0].dispatchedAt.getTime()).toBeLessThanOrEqual(after.getTime())
  })

  test('FakeQueue.reset clears all recorded jobs', () => {
    const fakeQueue = fake()
    fakeQueue.dispatch('Job1', {})
    fakeQueue.dispatch('Job2', {})
    fakeQueue.push('Job3', {})

    fakeQueue.reset()

    expect(fakeQueue.dispatched()).toHaveLength(0)
    expect(fakeQueue.pushed()).toHaveLength(0)
    expect(fakeQueue.processed()).toHaveLength(0)
    expect(fakeQueue.failed()).toHaveLength(0)
  })

  test('FakeQueue.processJob simulates processing', async () => {
    const fakeQueue = fake()
    fakeQueue.dispatch('SendEmail', { to: 'test@test.com' })

    let handledData: any = null
    await fakeQueue.processJob('SendEmail', async (data: any) => {
      handledData = data
    })

    expect(handledData).toEqual({ to: 'test@test.com' })
    expect(fakeQueue.processed()).toHaveLength(1)
    expect(fakeQueue.processed('SendEmail')).toHaveLength(1)
  })

  test('FakeQueue.processJob records failures', async () => {
    const fakeQueue = fake()
    fakeQueue.dispatch('FailingJob', {})

    await expect(
      fakeQueue.processJob('FailingJob', async () => {
        throw new Error('Job failed!')
      }),
    ).rejects.toThrow('Job failed!')

    expect(fakeQueue.failed()).toHaveLength(1)
    expect(fakeQueue.failed('FailingJob')).toHaveLength(1)
    expect(fakeQueue.failed()[0].error.message).toBe('Job failed!')
  })
})

// ============================================================================
// QueueTester - High-level testing helper
// ============================================================================

describe('Queue - QueueTester', () => {
  let tester: QueueTester

  beforeEach(() => {
    tester = createQueueTester()
  })

  afterEach(() => {
    tester.cleanup()
  })

  test('createQueueTester returns a QueueTester instance', () => {
    expect(tester).toBeInstanceOf(QueueTester)
  })

  test('QueueTester.dispatch records jobs', () => {
    tester.dispatch('TestJob', { value: 42 })

    const dispatched = tester.dispatched('TestJob')
    expect(dispatched).toHaveLength(1)
    expect(dispatched[0].data).toEqual({ value: 42 })
  })

  test('QueueTester.assertDispatched chains fluently', () => {
    tester.dispatch('Job1', {})
    tester.dispatch('Job2', {})

    const result = tester
      .assertDispatched('Job1')
      .assertDispatched('Job2')
      .assertNotDispatched('Job3')

    expect(result).toBe(tester)
  })

  test('QueueTester.assertDispatchedTimes validates count', () => {
    tester.dispatch('Job1', {})
    tester.dispatch('Job1', {})
    tester.dispatch('Job1', {})

    expect(() => tester.assertDispatchedTimes('Job1', 3)).not.toThrow()
    expect(() => tester.assertDispatchedTimes('Job1', 2)).toThrow()
  })

  test('QueueTester.assertNothingDispatched works when empty', () => {
    expect(() => tester.assertNothingDispatched()).not.toThrow()
  })

  test('QueueTester.push records delayed jobs', () => {
    tester.push('DelayedJob', { x: 1 }, { delay: 5000 } as any)

    const dispatched = tester.dispatched()
    // push goes to a separate list, dispatched should be empty
    expect(dispatched).toHaveLength(0)
  })

  test('QueueTester.reset clears state', () => {
    tester.dispatch('Job1', {})
    tester.reset()

    expect(tester.dispatched()).toHaveLength(0)
  })

  test('QueueTester enables faking globally', () => {
    // Creating a tester should enable fake mode
    expect(isFaked()).toBe(true)
  })

  test('QueueTester.cleanup restores normal mode', () => {
    tester.cleanup()
    expect(isFaked()).toBe(false)
  })
})

// ============================================================================
// expectJobToFail - Test helper
// ============================================================================

describe('Queue - expectJobToFail helper', () => {
  test('expectJobToFail catches job failures', async () => {
    const failingJob = {
      handle: async () => {
        throw new Error('Something went wrong')
      },
    }

    const error = await expectJobToFail(failingJob, undefined)
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe('Something went wrong')
  })

  test('expectJobToFail with expected error string', async () => {
    const failingJob = {
      handle: async () => {
        throw new Error('Database connection failed')
      },
    }

    const error = await expectJobToFail(failingJob, undefined, 'Database connection')
    expect(error.message).toContain('Database connection')
  })

  test('expectJobToFail with expected error regex', async () => {
    const failingJob = {
      handle: async () => {
        throw new Error('Timeout after 5000ms')
      },
    }

    const error = await expectJobToFail(failingJob, undefined, /Timeout after \d+ms/)
    expect(error.message).toMatch(/Timeout after \d+ms/)
  })

  test('expectJobToFail throws if job succeeds', async () => {
    const successfulJob = {
      handle: async () => 'success',
    }

    await expect(
      expectJobToFail(successfulJob, undefined),
    ).rejects.toThrow('Expected job to fail, but it succeeded')
  })

  test('expectJobToFail throws if error message does not match string', async () => {
    const failingJob = {
      handle: async () => {
        throw new Error('Actual error')
      },
    }

    await expect(
      expectJobToFail(failingJob, undefined, 'Expected error'),
    ).rejects.toThrow('Expected error to contain')
  })

  test('expectJobToFail throws if error message does not match regex', async () => {
    const failingJob = {
      handle: async () => {
        throw new Error('Actual error')
      },
    }

    await expect(
      expectJobToFail(failingJob, undefined, /^Expected pattern$/),
    ).rejects.toThrow('Expected error to match')
  })
})

// ============================================================================
// getRegisteredJobs - Scheduler state
// ============================================================================

describe('Queue - Scheduler Registry', () => {
  test('getRegisteredJobs returns a Map', () => {
    const jobs = getRegisteredJobs()
    expect(jobs).toBeInstanceOf(Map)
  })

  test('getRegisteredJobs returns empty Map when no jobs scheduled', () => {
    const jobs = getRegisteredJobs()
    // Without starting the scheduler, no jobs should be registered
    expect(jobs.size).toBe(0)
  })
})
