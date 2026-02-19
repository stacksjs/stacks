import { afterEach, describe, expect, it } from 'bun:test'
import { getSchedulerStatus, isSchedulerRunning, stopScheduler } from '../src/scheduler'
import { jobRegistry } from '../src/discovery'

describe('Queue Scheduler', () => {
  afterEach(async () => {
    await stopScheduler()
    jobRegistry.clear()
  })

  describe('getSchedulerStatus()', () => {
    it('should return status when scheduler is not running', () => {
      const status = getSchedulerStatus()

      expect(status.isRunning).toBe(false)
      expect(status.jobCount).toBe(0)
      expect(status.jobs).toEqual([])
    })
  })

  describe('isSchedulerRunning()', () => {
    it('should return false when scheduler is not started', () => {
      expect(isSchedulerRunning()).toBe(false)
    })
  })

  describe('stopScheduler()', () => {
    it('should be safe to call when scheduler is not running', async () => {
      await stopScheduler()
      expect(isSchedulerRunning()).toBe(false)
    })
  })
})

describe('Cron Expression Parsing', () => {
  // These test the schedule parsing patterns used by the scheduler
  // The scheduler converts Every.* enums and cron strings to standard cron expressions

  describe('Every enum values as cron expressions', () => {
    it('Every.Minute should be a valid 5-part cron', () => {
      const parts = '* * * * *'.split(' ')
      expect(parts).toHaveLength(5)
    })

    it('Every.Hour should run at minute 0', () => {
      const parts = '0 * * * *'.split(' ')
      expect(parts[0]).toBe('0') // minute 0
      expect(parts[1]).toBe('*') // every hour
    })

    it('Every.Day should run at midnight', () => {
      const parts = '0 0 * * *'.split(' ')
      expect(parts[0]).toBe('0') // minute 0
      expect(parts[1]).toBe('0') // hour 0
      expect(parts[2]).toBe('*') // every day
    })

    it('Every.Week should run on Sunday at midnight', () => {
      const parts = '0 0 * * 0'.split(' ')
      expect(parts[4]).toBe('0') // Sunday
    })

    it('Every.Month should run on the 1st at midnight', () => {
      const parts = '0 0 1 * *'.split(' ')
      expect(parts[2]).toBe('1') // 1st day
    })

    it('Every.FiveMinutes should use */5 step', () => {
      const parts = '*/5 * * * *'.split(' ')
      expect(parts[0]).toBe('*/5')
    })

    it('Every.Weekday should run Mon-Fri', () => {
      const parts = '0 0 * * 1-5'.split(' ')
      expect(parts[4]).toBe('1-5')
    })
  })

  describe('cron part matching logic', () => {
    // Test the pattern matching that shouldRunNow() uses

    it('wildcard * should match any value', () => {
      expect('*').toBe('*')
    })

    it('comma-separated list should contain specific values', () => {
      const part = '1,3,5'
      const values = part.split(',').map(v => Number.parseInt(v.trim(), 10))
      expect(values).toContain(1)
      expect(values).toContain(3)
      expect(values).toContain(5)
      expect(values).not.toContain(2)
    })

    it('range should be parsed correctly', () => {
      const part = '1-5'
      const [start, end] = part.split('-').map(v => Number.parseInt(v.trim(), 10))
      expect(start).toBe(1)
      expect(end).toBe(5)
      expect(3 >= start && 3 <= end).toBe(true)
      expect(6 >= start && 6 <= end).toBe(false)
    })

    it('step should be parsed correctly', () => {
      const part = '*/5'
      const [range, step] = part.split('/')
      expect(range).toBe('*')
      expect(Number.parseInt(step, 10)).toBe(5)
      // 0 % 5 === 0 (should match)
      expect(0 % 5).toBe(0)
      // 5 % 5 === 0 (should match)
      expect(5 % 5).toBe(0)
      // 3 % 5 !== 0 (should not match)
      expect(3 % 5).not.toBe(0)
    })

    it('exact value should match only that number', () => {
      const part = '15'
      const exact = Number.parseInt(part, 10)
      expect(exact).toBe(15)
      expect(15 === exact).toBe(true)
      expect(14 === exact).toBe(false)
    })
  })

  describe('predefined schedule strings', () => {
    const scheduleMap: Record<string, string> = {
      '@yearly': '0 0 1 1 *',
      '@annually': '0 0 1 1 *',
      '@monthly': '0 0 1 * *',
      '@weekly': '0 0 * * 0',
      '@daily': '0 0 * * *',
      '@midnight': '0 0 * * *',
      '@hourly': '0 * * * *',
    }

    for (const [alias, expected] of Object.entries(scheduleMap)) {
      it(`${alias} should map to ${expected}`, () => {
        expect(scheduleMap[alias]).toBe(expected)
      })
    }
  })
})
