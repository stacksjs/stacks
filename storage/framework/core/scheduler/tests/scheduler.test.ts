import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test'
import { DateTime } from 'luxon'
import { CronJob, Schedule, sendAt, timeout } from '../src'

describe('@stacksjs/scheduler', () => {
  let originalDateNow: () => number

  beforeEach(() => {
    originalDateNow = Date.now
    Date.now = () => new Date('2024-01-01T00:00:00Z').getTime()
  })

  afterEach(() => {
    Date.now = originalDateNow
  })

  describe('Schedule class', () => {
    it('should create a schedule with everySecond', () => {
      const task = mock(() => {})
      const schedule = new Schedule(task).everySecond()
      expect((schedule as any).cronPattern).toBe('* * * * * *')
    })

    it('should create a schedule with everyMinute', () => {
      const task = mock(() => {})
      const schedule = new Schedule(task).everyMinute()
      expect((schedule as any).cronPattern).toBe('0 * * * * *')
    })

    it('should create a schedule with everyTwoMinutes', () => {
      const task = mock(() => {})
      const schedule = new Schedule(task).everyTwoMinutes()
      expect((schedule as any).cronPattern).toBe('*/2 * * * * *')
    })

    it('should create a schedule with everyFiveMinutes', () => {
      const task = mock(() => {})
      const schedule = new Schedule(task).everyFiveMinutes()
      expect((schedule as any).cronPattern).toBe('*/5 * * * *')
    })

    it('should create a schedule with everyTenMinutes', () => {
      const task = mock(() => {})
      const schedule = new Schedule(task).everyTenMinutes()
      expect((schedule as any).cronPattern).toBe('*/10 * * * *')
    })

    it('should create a schedule with everyThirtyMinutes', () => {
      const task = mock(() => {})
      const schedule = new Schedule(task).everyThirtyMinutes()
      expect((schedule as any).cronPattern).toBe('*/30 * * * *')
    })

    it('should create a schedule with hourly', () => {
      const task = mock(() => {})
      const schedule = new Schedule(task).hourly()
      expect((schedule as any).cronPattern).toBe('0 0 * * * *')
    })

    it('should create a schedule with daily', () => {
      const task = mock(() => {})
      const schedule = new Schedule(task).daily()
      expect((schedule as any).cronPattern).toBe('0 0 0 * * *')
    })

    it('should create a schedule with weekly', () => {
      const task = mock(() => {})
      const schedule = new Schedule(task).weekly()
      expect((schedule as any).cronPattern).toBe('0 0 0 * * 0')
    })

    it('should create a schedule with monthly', () => {
      const task = mock(() => {})
      const schedule = new Schedule(task).monthly()
      expect((schedule as any).cronPattern).toBe('0 0 0 1 * *')
    })

    it('should create a schedule with yearly', () => {
      const task = mock(() => {})
      const schedule = new Schedule(task).yearly()
      expect((schedule as any).cronPattern).toBe('0 0 0 1 1 *')
    })

    it('should create a schedule with onDays', () => {
      const task = mock(() => {})
      const schedule = new Schedule(task).onDays([1, 3, 5])
      expect((schedule as any).cronPattern).toBe('0 0 0 * * 1,3,5')
    })

    it('should create a schedule with at', () => {
      const task = mock(() => {})
      const schedule = new Schedule(task).at('14:30')
      expect((schedule as any).cronPattern).toBe('30 14 * * *')
    })

    it('should set timezone', () => {
      const task = mock(() => {})
      const schedule = new Schedule(task).setTimeZone('UTC')
      expect((schedule as any).timezone).toBe('UTC')
    })

    it('should start the schedule', () => {
      const task = mock(() => {})
      const schedule = new Schedule(task).everyMinute()
      const cronJobSpy = spyOn(CronJob, 'from').mockImplementation(() => ({}) as any)
      schedule.start()
      expect(cronJobSpy).toHaveBeenCalledWith('0 * * * * *', expect.any(Function), null, true, 'America/Los_Angeles')
    })

    it('should log job scheduling', () => {
      const task = mock(() => {})
      const logSpy = spyOn(console, 'info')
      new Schedule(task).job('/path/to/job')
      expect(logSpy).toHaveBeenCalledWith('Scheduling job: /path/to/job')
    })

    it('should log action scheduling', () => {
      const task = mock(() => {})
      const logSpy = spyOn(console, 'info')
      new Schedule(task).action('/path/to/action')
      expect(logSpy).toHaveBeenCalledWith('Scheduling action: /path/to/action')
    })

    it('should log command execution', () => {
      const logSpy = spyOn(console, 'info')
      Schedule.command('echo "Hello"')
      expect(logSpy).toHaveBeenCalledWith('Executing command: echo "Hello"')
    })
  })

  describe('sendAt function', () => {
    it('should return correct DateTime for cron string', () => {
      const result = sendAt('0 0 * * *')
      expect(result).toBeInstanceOf(DateTime)
      expect(result.toISO()).toBe('2024-01-02T00:00:00.000Z')
    })

    it('should return correct DateTime for Date object', () => {
      const date = new Date('2024-01-01T12:00:00Z')
      const result = sendAt(date)
      expect(result).toBeInstanceOf(DateTime)
      expect(result.toISO()).toBe('2024-01-01T12:00:00.000Z')
    })
  })

  describe('timeout function', () => {
    it('should return correct timeout for cron string', () => {
      const result = timeout('0 0 * * *')
      expect(result).toBe(86400000) // 24 hours in milliseconds
    })

    it('should return correct timeout for Date object', () => {
      const date = new Date('2024-01-01T12:00:00Z')
      const result = timeout(date)
      expect(result).toBe(43200000) // 12 hours in milliseconds
    })
  })
})
