import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { CronJob, CronTime, Job, Schedule, sendAt, timeout } from '../src'

// Mock log.info
const mockLogInfo = mock(() => {})
mock.module('@stacksjs/cli', () => ({
  log: { info: mockLogInfo },
}))

describe('@stacksjs/scheduler', () => {
  let schedule: Schedule
  let mockTask: () => void

  beforeEach(() => {
    mockTask = mock(() => {})
    schedule = new Schedule(mockTask)
    mockLogInfo.mockClear()
  })

  describe('Schedule methods', () => {
    it.each([
      ['everySecond', '* * * * * *'],
      ['everyMinute', '0 * * * * *'],
      ['everyTwoMinutes', '*/2 * * * * *'],
      ['everyFiveMinutes', '*/5 * * * *'],
      ['everyTenMinutes', '*/10 * * * *'],
      ['everyThirtyMinutes', '*/30 * * * *'],
      ['everyHour', '0 0 * * * *'],
      ['everyDay', '0 0 0 * * *'],
      ['hourly', '0 0 * * * *'],
      ['daily', '0 0 0 * * *'],
      ['weekly', '0 0 0 * * 0'],
      ['monthly', '0 0 0 1 * *'],
      ['yearly', '0 0 0 1 1 *'],
    ])('should set correct cron pattern for %s', (method, expectedPattern) => {
      ;(schedule as any)[method]().start()
      expect(mockLogInfo).toHaveBeenCalledWith(
        `Scheduled task with pattern: ${expectedPattern} in timezone: America/Los_Angeles`,
      )
    })

    it('should set correct cron pattern for onDays', () => {
      schedule.onDays([1, 3, 5]).start()
      expect(mockLogInfo).toHaveBeenCalledWith(
        'Scheduled task with pattern: 0 0 0 * * 1,3,5 in timezone: America/Los_Angeles',
      )
    })

    it('should set correct cron pattern for at', () => {
      schedule.at('14:30').start()
      expect(mockLogInfo).toHaveBeenCalledWith(
        'Scheduled task with pattern: 30 14 * * * in timezone: America/Los_Angeles',
      )
    })

    it('should set timezone', () => {
      schedule.daily().setTimeZone('Europe/London').start()
      expect(mockLogInfo).toHaveBeenCalledWith('Scheduled task with pattern: 0 0 0 * * * in timezone: Europe/London')
    })
  })

  describe('Job and Action methods', () => {
    it('should log job scheduling', () => {
      schedule.job('path/to/job')
      expect(mockLogInfo).toHaveBeenCalledWith('Scheduling job: path/to/job')
    })

    it('should log action scheduling', () => {
      schedule.action('path/to/action')
      expect(mockLogInfo).toHaveBeenCalledWith('Scheduling action: path/to/action')
    })
  })

  describe('Static command method', () => {
    it('should log command execution', () => {
      Schedule.command('npm run build')
      expect(mockLogInfo).toHaveBeenCalledWith('Executing command: npm run build')
    })
  })

  describe('Job class', () => {
    it('should inherit from Schedule', () => {
      const job = new Job(mockTask)
      expect(job).toBeInstanceOf(Schedule)
    })

    it('should have the same methods as Schedule', () => {
      const job = new Job(mockTask)
      expect(job.everyMinute).toBeDefined()
      expect(job.daily).toBeDefined()
      expect(job.setTimeZone).toBeDefined()
    })
  })

  describe('sendAt function', () => {
    it('should return a DateTime-like object', () => {
      const result = sendAt('0 0 * * *')
      expect(result).toHaveProperty('year')
      expect(result).toHaveProperty('month')
      expect(result).toHaveProperty('day')
      expect(result).toHaveProperty('hour')
      expect(result).toHaveProperty('minute')
      expect(result).toHaveProperty('second')
    })

    it('should calculate the next occurrence correctly', () => {
      const now = new Date()
      const result = sendAt('0 0 * * *')
      expect(result.toJSDate() > now).toBe(true)
      expect(result.hour).toBe(0)
      expect(result.minute).toBe(0)
    })
  })

  describe('timeout function', () => {
    it('should return a number', () => {
      const result = timeout('0 0 * * *')
      expect(typeof result).toBe('number')
    })

    it('should return a positive number', () => {
      const result = timeout('0 0 * * *')
      expect(result).toBeGreaterThan(0)
    })
  })

  describe('CronJob integration', () => {
    it('should create a CronJob instance when start is called', () => {
      const mockTask = mock(() => {})
      const schedule = new Schedule(mockTask)

      schedule.everySecond().start()

      // Check if mockLogInfo was called with the correct message
      expect(mockLogInfo).toHaveBeenCalledWith(
        'Scheduled task with pattern: * * * * * * in timezone: America/Los_Angeles',
      )
    })

    it('should create a CronJob with correct parameters', () => {
      const mockTask = mock(() => {})
      const schedule = new Schedule(mockTask)

      schedule.everyMinute().setTimeZone('Europe/London').start()

      expect(mockLogInfo).toHaveBeenCalledWith('Scheduled task with pattern: 0 * * * * * in timezone: Europe/London')
    })

    describe('Cron exports', () => {
      it('CronJob is exported and can be instantiated', () => {
        const job = new CronJob('* * * * *', () => {})
        expect(job).toBeInstanceOf(CronJob)
      })

      it('CronTime is exported and can be instantiated', () => {
        const time = new CronTime('* * * * *')
        expect(time).toBeInstanceOf(CronTime)
      })
    })
  })
})
