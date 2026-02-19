import { describe, expect, it, mock, beforeEach } from 'bun:test'
import { job } from '../src/job'

describe('JobBuilder', () => {
  describe('job() factory', () => {
    it('should create a JobBuilder instance', () => {
      const builder = job('SendEmail')

      expect(builder).toBeDefined()
      expect(typeof builder.dispatch).toBe('function')
      expect(typeof builder.dispatchNow).toBe('function')
      expect(typeof builder.onQueue).toBe('function')
      expect(typeof builder.delay).toBe('function')
      expect(typeof builder.tries).toBe('function')
      expect(typeof builder.timeout).toBe('function')
      expect(typeof builder.backoff).toBe('function')
      expect(typeof builder.withContext).toBe('function')
    })

    it('should accept an optional payload', () => {
      const builder = job('SendEmail', { to: 'user@test.com' })
      expect(builder).toBeDefined()
    })
  })

  describe('fluent API', () => {
    it('should return this for chaining', () => {
      const builder = job('TestJob')

      const result = builder
        .onQueue('emails')
        .delay(30)
        .tries(5)
        .timeout(60)
        .backoff([10, 30, 60])
        .withContext({ source: 'test' })

      expect(result).toBe(builder)
    })

    it('onQueue should set queue name', () => {
      const builder = job('TestJob').onQueue('high-priority')
      // Verify it doesn't throw and returns builder
      expect(builder).toBeDefined()
    })

    it('delay should accept seconds', () => {
      const builder = job('TestJob').delay(60)
      expect(builder).toBeDefined()
    })

    it('tries should accept count', () => {
      const builder = job('TestJob').tries(10)
      expect(builder).toBeDefined()
    })

    it('timeout should accept seconds', () => {
      const builder = job('TestJob').timeout(120)
      expect(builder).toBeDefined()
    })

    it('backoff should accept delay array', () => {
      const builder = job('TestJob').backoff([5, 10, 30, 60])
      expect(builder).toBeDefined()
    })

    it('withContext should accept context object', () => {
      const builder = job('TestJob').withContext({ userId: 1, role: 'admin' })
      expect(builder).toBeDefined()
    })
  })

  describe('dispatchNow', () => {
    it('should execute the job immediately via runJob', async () => {
      // Inspire job exists in app/Jobs and we know it works
      const builder = job('Inspire')

      // dispatchNow calls runJob internally which imports and runs the job
      await builder.dispatchNow()
      // If we get here without throwing, the job executed successfully
    })
  })
})
