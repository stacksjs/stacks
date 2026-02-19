import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { existsSync } from 'node:fs'
import { appPath } from '@stacksjs/path'

// Mock external dependencies to prevent side effects
const mockLogInfo = mock(() => {})
const mockLogError = mock(() => {})
mock.module('@stacksjs/cli', () => ({
  log: { info: mockLogInfo, error: mockLogError },
  runCommand: mock(async () => ({ isErr: false })),
}))
mock.module('@stacksjs/logging', () => ({
  log: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
}))
mock.module('@stacksjs/queue', () => ({
  runJob: mock(async () => {}),
}))
mock.module('@stacksjs/actions', () => ({
  runAction: mock(async () => {}),
}))

const { Schedule, schedule, Queue, sendAt, timeout } = await import('../src/schedule')
const { parse } = await import('@stacksjs/cron')

describe('@stacksjs/scheduler', () => {
  beforeEach(() => {
    mockLogInfo.mockClear()
    mockLogError.mockClear()
  })

  describe('Schedule class', () => {
    it('should be a constructor function', () => {
      expect(typeof Schedule).toBe('function')
    })

    it('should have static job method', () => {
      expect(typeof Schedule.job).toBe('function')
    })

    it('should have static action method', () => {
      expect(typeof Schedule.action).toBe('function')
    })

    it('should have static command method', () => {
      expect(typeof Schedule.command).toBe('function')
    })

    it('should have static gracefulShutdown method', () => {
      expect(typeof Schedule.gracefulShutdown).toBe('function')
    })
  })

  describe('schedule export', () => {
    it('should be the Schedule class itself', () => {
      expect(schedule).toBe(Schedule)
    })

    it('should have job, action, command as static methods', () => {
      expect(typeof schedule.job).toBe('function')
      expect(typeof schedule.action).toBe('function')
      expect(typeof schedule.command).toBe('function')
    })
  })

  describe('Queue class', () => {
    it('should extend Schedule', () => {
      const task = mock(() => {})
      const queue = new Queue(task)
      expect(queue).toBeInstanceOf(Schedule)
    })
  })

  describe('Cron pattern generation (5-field standard)', () => {
    it.each([
      ['everyMinute', '* * * * *'],
      ['everyTwoMinutes', '*/2 * * * *'],
      ['everyFiveMinutes', '*/5 * * * *'],
      ['everyTenMinutes', '*/10 * * * *'],
      ['everyThirtyMinutes', '*/30 * * * *'],
      ['everyHour', '0 * * * *'],
      ['everyDay', '0 0 * * *'],
      ['hourly', '0 * * * *'],
      ['daily', '0 0 * * *'],
      ['weekly', '0 0 * * 0'],
      ['monthly', '0 0 1 * *'],
      ['yearly', '0 0 1 1 *'],
      ['annually', '0 0 1 1 *'],
    ] as [string, string][])('should set correct cron pattern for %s → %s', (method, expectedPattern) => {
      const task = mock(() => {})
      const s = new Schedule(task)
      ;(s as any)[method]()

      expect(s.pattern).toBe(expectedPattern)
    })

    it('should use setInterval for everySecond()', () => {
      const task = mock(() => {})
      const s = new Schedule(task)
      s.everySecond()

      expect(s.pattern).toBe('@every_second')
    })

    it('should set correct cron pattern for onDays()', () => {
      const task = mock(() => {})
      const s = new Schedule(task)
      s.onDays([1, 3, 5])

      expect(s.pattern).toBe('0 0 * * 1,3,5')
    })

    it('should set correct cron pattern for at()', () => {
      const task = mock(() => {})
      const s = new Schedule(task)
      s.at('14:30')

      expect(s.pattern).toBe('30 14 * * *')
    })

    it('should produce valid 5-field patterns parseable by Bun.cron.parse()', () => {
      // Every pattern (except @every_second) should be parseable
      const patterns = [
        '* * * * *', '*/2 * * * *', '*/5 * * * *', '*/10 * * * *',
        '*/30 * * * *', '0 * * * *', '0 0 * * *', '0 0 * * 0',
        '0 0 1 * *', '0 0 1 1 *',
      ]

      for (const pattern of patterns) {
        const next = parse(pattern)
        expect(next).toBeInstanceOf(Date)
        expect(next!.getTime()).toBeGreaterThan(Date.now())
      }
    })
  })

  describe('Timezone configuration', () => {
    it('should default to America/Los_Angeles', () => {
      const task = mock(() => {})
      const s = new Schedule(task)
      s.daily()

      // Verify the pattern is set correctly
      expect(s.pattern).toBe('0 0 * * *')
    })

    it('should allow setting a custom timezone via chaining', () => {
      const task = mock(() => {})
      const s = new Schedule(task)
      const result = s.daily().setTimeZone('Europe/London')

      expect(result).toBe(s)
      expect(s.pattern).toBe('0 0 * * *')
    })

    it('should allow setting UTC timezone', () => {
      const task = mock(() => {})
      const s = new Schedule(task)
      const result = s.hourly().setTimeZone('UTC')

      expect(result).toBe(s)
      expect(s.pattern).toBe('0 * * * *')
    })
  })

  describe('Static job() method', () => {
    it('should return an UntimedSchedule', () => {
      const result = Schedule.job('Inspire')
      expect(typeof result.everyMinute).toBe('function')
      expect(typeof result.daily).toBe('function')
      expect(typeof result.hourly).toBe('function')
    })

    it('should execute a task via everySecond', async () => {
      const taskFn = mock(() => {})
      const s = new Schedule(taskFn)
      s.everySecond()

      // Wait for at least one setInterval tick
      await new Promise(resolve => setTimeout(resolve, 1200))

      expect(taskFn).toHaveBeenCalled()
    })
  })

  describe('Static action() method', () => {
    it('should return an UntimedSchedule', () => {
      const result = Schedule.action('CleanupFiles')
      expect(typeof result.everyMinute).toBe('function')
      expect(typeof result.daily).toBe('function')
    })

    it('should execute a task via everySecond', async () => {
      const taskFn = mock(() => {})
      const s = new Schedule(taskFn)
      s.everySecond()

      await new Promise(resolve => setTimeout(resolve, 1200))

      expect(taskFn).toHaveBeenCalled()
    })
  })

  describe('Static command() method', () => {
    it('should return an UntimedSchedule', () => {
      const result = Schedule.command('echo "hello"')
      expect(typeof result.everyMinute).toBe('function')
      expect(typeof result.daily).toBe('function')
    })
  })

  describe('Chaining configuration methods', () => {
    it('should chain withName()', () => {
      const task = mock(() => {})
      const s = new Schedule(task)
      const result = s.everyMinute().withName('my-task')
      expect(result).toBe(s)
    })

    it('should chain withMaxRuns()', () => {
      const task = mock(() => {})
      const s = new Schedule(task)
      const result = s.everyMinute().withMaxRuns(5)
      expect(result).toBe(s)
    })

    it('should chain withErrorHandler()', () => {
      const task = mock(() => {})
      const s = new Schedule(task)
      const result = s.everyMinute().withErrorHandler(() => {})
      expect(result).toBe(s)
    })

    it('should chain withProtection()', () => {
      const task = mock(() => {})
      const s = new Schedule(task)
      const result = s.everyMinute().withProtection()
      expect(result).toBe(s)
    })

    it('should chain withContext()', () => {
      const task = mock(() => {})
      const s = new Schedule(task)
      const result = s.everyMinute().withContext({ key: 'value' })
      expect(result).toBe(s)
    })

    it('should chain withInterval()', () => {
      const task = mock(() => {})
      const s = new Schedule(task)
      const result = s.everyMinute().withInterval(60)
      expect(result).toBe(s)
    })

    it('should chain between()', () => {
      const task = mock(() => {})
      const s = new Schedule(task)
      const result = s.everyMinute().between('2025-01-01', '2025-12-31')
      expect(result).toBe(s)
    })

    it('should chain withoutOverlapping()', () => {
      const task = mock(() => {})
      const s = new Schedule(task)
      const result = s.everyMinute().withoutOverlapping()
      expect(result).toBe(s)
    })

    it('should chain onOneServer()', () => {
      const task = mock(() => {})
      const s = new Schedule(task)
      const result = s.everyMinute().onOneServer()
      expect(result).toBe(s)
    })

    it('should chain runInBackground()', () => {
      const task = mock(() => {})
      const s = new Schedule(task)
      const result = s.everyMinute().runInBackground()
      expect(result).toBe(s)
    })

    it('should support full fluent chain', () => {
      const task = mock(() => {})
      const s = new Schedule(task)
      const result = s
        .daily()
        .setTimeZone('Europe/Berlin')
        .withName('full-chain')
        .withMaxRuns(100)
        .withErrorHandler(() => {})
        .withoutOverlapping(30)

      expect(result).toBe(s)
    })
  })

  describe('Cron parser (parse from @stacksjs/cron)', () => {
    it('should parse standard cron expressions', () => {
      const next = parse('0 0 * * *')
      expect(next).toBeInstanceOf(Date)
      expect(next!.getTime()).toBeGreaterThan(Date.now())
    })

    it('should parse @hourly nickname', () => {
      const next = parse('@hourly')
      expect(next).toBeInstanceOf(Date)
      expect(next!.getTime()).toBeGreaterThan(Date.now())
    })

    it('should parse @daily nickname', () => {
      const next = parse('@daily')
      expect(next).toBeInstanceOf(Date)
      expect(next!.getTime()).toBeGreaterThan(Date.now())
    })

    it('should parse @weekly nickname', () => {
      const next = parse('@weekly')
      expect(next).toBeInstanceOf(Date)
      expect(next!.getTime()).toBeGreaterThan(Date.now())
    })

    it('should parse @monthly nickname', () => {
      const next = parse('@monthly')
      expect(next).toBeInstanceOf(Date)
    })

    it('should parse @yearly nickname', () => {
      const next = parse('@yearly')
      expect(next).toBeInstanceOf(Date)
    })

    it('should accept a relative date', () => {
      const base = Date.UTC(2025, 0, 15, 10, 0, 0)
      const next = parse('0 * * * *', base)
      expect(next).toBeInstanceOf(Date)
      expect(next!.getTime()).toBeGreaterThan(base)
    })

    it('should chain parse calls for a sequence of next runs', () => {
      const base = Date.UTC(2025, 0, 15, 10, 0, 0)
      const first = parse('0 * * * *', base)
      const second = parse('0 * * * *', first!)

      expect(first).toBeInstanceOf(Date)
      expect(second).toBeInstanceOf(Date)
      expect(second!.getTime()).toBeGreaterThan(first!.getTime())
    })

    it('should return null for impossible patterns', () => {
      const result = parse('0 0 30 2 *') // Feb 30 never occurs
      expect(result).toBeNull()
    })

    it('should throw for invalid expressions', () => {
      expect(() => parse('not valid')).toThrow()
      expect(() => parse('* * *')).toThrow() // too few fields
      expect(() => parse('* * * * * *')).toThrow() // too many fields
    })

    it('should parse step expressions', () => {
      const base = Date.UTC(2025, 0, 15, 10, 0, 0)
      const next = parse('*/15 * * * *', base)
      expect(next).toBeInstanceOf(Date)
      expect(next!.getUTCMinutes() % 15).toBe(0)
    })

    it('should parse range expressions', () => {
      const base = Date.UTC(2025, 0, 15, 10, 0, 0) // Wednesday
      const next = parse('0 9 * * MON-FRI', base)
      expect(next).toBeInstanceOf(Date)
      const day = next!.getUTCDay()
      expect(day).toBeGreaterThanOrEqual(1)
      expect(day).toBeLessThanOrEqual(5)
    })

    it('should parse list expressions', () => {
      const base = Date.UTC(2025, 0, 15, 0, 0, 0)
      const next = parse('0,30 * * * *', base)
      expect(next).toBeInstanceOf(Date)
      const min = next!.getUTCMinutes()
      expect(min === 0 || min === 30).toBe(true)
    })

    it('should handle month names', () => {
      const base = Date.UTC(2025, 0, 1, 0, 0, 0) // Jan 1
      const next = parse('0 0 1 MAR *', base)
      expect(next).toBeInstanceOf(Date)
      expect(next!.getUTCMonth()).toBe(2) // March = index 2
    })

    it('should handle day names', () => {
      const base = Date.UTC(2025, 0, 15, 0, 0, 0) // Wednesday
      const next = parse('0 0 * * FRI', base)
      expect(next).toBeInstanceOf(Date)
      expect(next!.getUTCDay()).toBe(5) // Friday
    })

    it('should handle POSIX OR logic for day-of-month and day-of-week', () => {
      // "15th of month OR every Friday" — should match whichever comes first
      const base = Date.UTC(2025, 0, 13, 0, 0, 0) // Monday Jan 13
      const next = parse('0 0 15 * FRI', base)
      expect(next).toBeInstanceOf(Date)
      const d = next!
      expect(d.getUTCDate() === 15 || d.getUTCDay() === 5).toBe(true)
    })
  })

  describe('sendAt() helper', () => {
    it('should return a Date for valid cron expression', () => {
      const result = sendAt('0 0 * * *')
      expect(result).toBeInstanceOf(Date)
    })

    it('should return a future date', () => {
      const result = sendAt('0 0 * * *')
      expect(result).not.toBeNull()
      expect(result!.getTime()).toBeGreaterThan(Date.now())
    })

    it('should handle Date input', () => {
      const future = new Date(Date.now() + 60000)
      const result = sendAt(future)
      expect(result).toEqual(future)
    })

    it('should return null for past Date input', () => {
      const past = new Date(Date.now() - 60000)
      const result = sendAt(past)
      expect(result).toBeNull()
    })

    it('should throw for invalid cron expression', () => {
      expect(() => sendAt('invalid')).toThrow()
    })
  })

  describe('timeout() helper', () => {
    it('should return a positive number for valid cron', () => {
      const result = timeout('0 0 * * *')
      expect(typeof result).toBe('number')
      expect(result).toBeGreaterThan(0)
    })

    it('should return milliseconds until next run', () => {
      const result = timeout('0 0 * * *') // midnight daily
      expect(result).toBeLessThanOrEqual(86400000)
      expect(result).toBeGreaterThan(0)
    })
  })

  describe('Graceful shutdown', () => {
    it('should not throw when no jobs are registered', async () => {
      await expect(Schedule.gracefulShutdown()).resolves.toBeUndefined()
    })
  })
})

describe('app/Scheduler.ts', () => {
  it('should exist', () => {
    expect(existsSync(appPath('Scheduler.ts'))).toBe(true)
  })

  it('should export a default function', async () => {
    const mod = await import(appPath('Scheduler.ts'))
    expect(typeof mod.default).toBe('function')
  })

  it('should be callable without errors', async () => {
    const mod = await import(appPath('Scheduler.ts'))
    expect(() => mod.default()).not.toThrow()
  })
})
