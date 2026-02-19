import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { Job } from '../src/action'
import { discoverJobs, executeJob, getAllJobs, getScheduledJobs, jobRegistry, toJobOptions } from '../src/discovery'
import { Every } from '@stacksjs/types'

describe('Job Class', () => {
  describe('constructor', () => {
    it('should create a job with all options', () => {
      const handler = mock(() => ({ success: true }))
      const job = new Job({
        name: 'TestJob',
        description: 'A test job',
        queue: 'emails',
        tries: 5,
        backoff: [10, 30, 60],
        rate: Every.Hour,
        timeout: 30000,
        handle: handler,
      })

      expect(job.name).toBe('TestJob')
      expect(job.description).toBe('A test job')
      expect(job.queue).toBe('emails')
      expect(job.tries).toBe(5)
      expect(job.backoff).toEqual([10, 30, 60])
      expect(job.rate).toBe(Every.Hour)
      expect(job.timeout).toBe(30000)
      expect(job.handle).toBe(handler)
    })

    it('should create a job with minimal options', () => {
      const job = new Job({
        handle: () => 'done',
      })

      expect(job.name).toBeUndefined()
      expect(job.description).toBeUndefined()
      expect(job.queue).toBeUndefined()
      expect(job.tries).toBeUndefined()
      expect(job.backoff).toBeUndefined()
      expect(job.rate).toBeUndefined()
      expect(typeof job.handle).toBe('function')
    })

    it('should accept an action string instead of handle', () => {
      const job = new Job({
        name: 'ActionJob',
        action: 'SendWelcomeEmail',
      })

      expect(job.action).toBe('SendWelcomeEmail')
      expect(job.handle).toBeUndefined()
    })

    it('should accept a numeric backoff value', () => {
      const job = new Job({
        name: 'SimpleBackoff',
        backoff: 5,
        handle: () => {},
      })

      expect(job.backoff).toBe(5)
    })

    it('should accept an array backoff value', () => {
      const job = new Job({
        name: 'ArrayBackoff',
        backoff: [10, 30, 60],
        handle: () => {},
      })

      expect(job.backoff).toEqual([10, 30, 60])
    })

    it('should accept backoffConfig for advanced retry strategies', () => {
      const job = new Job({
        name: 'AdvancedBackoff',
        backoffConfig: {
          strategy: 'exponential',
          initialDelay: 1000,
          factor: 2,
          maxDelay: 60000,
        },
        handle: () => {},
      })

      expect(job.backoffConfig).toEqual({
        strategy: 'exponential',
        initialDelay: 1000,
        factor: 2,
        maxDelay: 60000,
      })
    })

    it('should accept Every enum values for rate', () => {
      const job = new Job({
        name: 'ScheduledJob',
        rate: Every.FiveMinutes,
        handle: () => {},
      })

      expect(job.rate).toBe('*/5 * * * *')
    })

    it('should accept cron string for rate', () => {
      const job = new Job({
        name: 'CronJob',
        rate: '0 0 * * *',
        handle: () => {},
      })

      expect(job.rate).toBe('0 0 * * *')
    })

    it('should accept enabled flag', () => {
      const job = new Job({
        name: 'DisabledJob',
        enabled: false,
        handle: () => {},
      })

      expect(job.enabled).toBe(false)
    })
  })

  describe('handle execution', () => {
    it('should execute synchronous handle', () => {
      const job = new Job({
        name: 'SyncJob',
        handle: (payload: any) => ({ received: payload }),
      })

      const result = (job.handle as Function)({ data: 'test' })
      expect(result).toEqual({ received: { data: 'test' } })
    })

    it('should execute async handle', async () => {
      const job = new Job({
        name: 'AsyncJob',
        handle: async (payload: any) => {
          return { processed: true, input: payload }
        },
      })

      const result = await (job.handle as Function)({ userId: 1 })
      expect(result).toEqual({ processed: true, input: { userId: 1 } })
    })

    it('should handle when handle is undefined', () => {
      const job = new Job({ name: 'NoHandleJob' })
      expect(job.handle).toBeUndefined()
    })
  })
})

describe('Job Discovery', () => {
  beforeEach(() => {
    jobRegistry.clear()
  })

  it('should discover jobs from app/Jobs directory', async () => {
    const jobs = await discoverJobs()

    expect(jobs.length).toBeGreaterThanOrEqual(1)

    const inspireJob = jobs.find(j => j.name === 'Inspire')
    expect(inspireJob).toBeDefined()
    expect(inspireJob!.type).toBe('function')
    expect(inspireJob!.config.queue).toBe('default')
  })

  it('should register discovered jobs in the registry', async () => {
    await discoverJobs()

    expect(jobRegistry.has('Inspire')).toBe(true)
    expect(jobRegistry.isInitialized()).toBe(true)
  })

  it('should detect scheduled jobs', async () => {
    await discoverJobs()

    const scheduled = getScheduledJobs()
    expect(scheduled.length).toBeGreaterThanOrEqual(1)

    const inspireScheduled = scheduled.find(j => j.name === 'Inspire')
    expect(inspireScheduled).toBeDefined()
    expect(inspireScheduled!.config.rate).toBe('0 * * * *')
  })

  it('should return all discovered jobs', async () => {
    await discoverJobs()

    const all = getAllJobs()
    expect(all.length).toBeGreaterThanOrEqual(1)
  })

  it('should skip test files during discovery', async () => {
    const jobs = await discoverJobs()

    const testJob = jobs.find(j => j.path.includes('.test.') || j.path.includes('.spec.'))
    expect(testJob).toBeUndefined()
  })

  it('should skip index files during discovery', async () => {
    const jobs = await discoverJobs()

    const indexJob = jobs.find(j => j.path.endsWith('index.ts') || j.path.endsWith('index.js'))
    expect(indexJob).toBeUndefined()
  })

  it('should clear the registry', async () => {
    await discoverJobs()
    expect(jobRegistry.has('Inspire')).toBe(true)

    jobRegistry.clear()
    expect(jobRegistry.has('Inspire')).toBe(false)
    expect(jobRegistry.isInitialized()).toBe(false)
  })
})

describe('Job Execution', () => {
  beforeEach(async () => {
    jobRegistry.clear()
    await discoverJobs()
  })

  it('should execute a discovered job by name', async () => {
    const result = await executeJob('Inspire')

    expect(result).toBeDefined()
    expect(result.quote).toBeDefined()
    expect(typeof result.quote).toBe('string')
  })

  it('should throw when executing an unknown job', async () => {
    expect(executeJob('NonExistentJob')).rejects.toThrow('Job "NonExistentJob" not found')
  })
})

describe('toJobOptions', () => {
  it('should convert discovered job to JobOptions format', async () => {
    await discoverJobs()

    const job = jobRegistry.get('Inspire')
    expect(job).toBeDefined()

    const options = toJobOptions(job!)
    expect(options.name).toBe('Inspire')
    expect(options.queue).toBe('default')
    expect(options.tries).toBe(3)
    expect(options.rate).toBe('0 * * * *')
  })
})

describe('JobRegistry', () => {
  beforeEach(() => {
    jobRegistry.clear()
  })

  it('should register and retrieve jobs', () => {
    const job = {
      name: 'TestJob',
      path: '/tmp/TestJob.ts',
      config: { name: 'TestJob', queue: 'default', tries: 3 },
      type: 'function' as const,
      module: { handle: () => {} },
    }

    jobRegistry.register(job)
    expect(jobRegistry.get('TestJob')).toBe(job)
    expect(jobRegistry.has('TestJob')).toBe(true)
  })

  it('should list all registered jobs', () => {
    jobRegistry.register({
      name: 'Job1',
      path: '/tmp/Job1.ts',
      config: { name: 'Job1', queue: 'default' },
      type: 'function',
      module: {},
    })

    jobRegistry.register({
      name: 'Job2',
      path: '/tmp/Job2.ts',
      config: { name: 'Job2', queue: 'emails' },
      type: 'function',
      module: {},
    })

    expect(jobRegistry.all()).toHaveLength(2)
  })

  it('should filter jobs by queue', () => {
    jobRegistry.register({
      name: 'DefaultJob',
      path: '/tmp/DefaultJob.ts',
      config: { name: 'DefaultJob', queue: 'default' },
      type: 'function',
      module: {},
    })

    jobRegistry.register({
      name: 'EmailJob',
      path: '/tmp/EmailJob.ts',
      config: { name: 'EmailJob', queue: 'emails' },
      type: 'function',
      module: {},
    })

    const emailJobs = jobRegistry.byQueue('emails')
    expect(emailJobs).toHaveLength(1)
    expect(emailJobs[0].name).toBe('EmailJob')
  })

  it('should filter scheduled jobs', () => {
    jobRegistry.register({
      name: 'ScheduledJob',
      path: '/tmp/ScheduledJob.ts',
      config: { name: 'ScheduledJob', rate: '* * * * *' },
      type: 'function',
      module: {},
    })

    jobRegistry.register({
      name: 'NonScheduledJob',
      path: '/tmp/NonScheduledJob.ts',
      config: { name: 'NonScheduledJob' },
      type: 'function',
      module: {},
    })

    const scheduled = jobRegistry.scheduled()
    expect(scheduled).toHaveLength(1)
    expect(scheduled[0].name).toBe('ScheduledJob')
  })

  it('should track initialization state', () => {
    expect(jobRegistry.isInitialized()).toBe(false)

    jobRegistry.setInitialized(true)
    expect(jobRegistry.isInitialized()).toBe(true)

    jobRegistry.clear()
    expect(jobRegistry.isInitialized()).toBe(false)
  })
})

describe('Every enum values', () => {
  it('should have correct cron expressions', () => {
    expect(Every.Minute).toBe('* * * * *')
    expect(Every.FiveMinutes).toBe('*/5 * * * *')
    expect(Every.TenMinutes).toBe('*/10 * * * *')
    expect(Every.FifteenMinutes).toBe('*/15 * * * *')
    expect(Every.ThirtyMinutes).toBe('*/30 * * * *')
    expect(Every.Hour).toBe('0 * * * *')
    expect(Every.Day).toBe('0 0 * * *')
    expect(Every.Week).toBe('0 0 * * 0')
    expect(Every.Month).toBe('0 0 1 * *')
    expect(Every.Year).toBe('0 0 1 1 *')
  })
})
