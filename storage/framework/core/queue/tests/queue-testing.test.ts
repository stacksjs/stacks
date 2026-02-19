import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import {
  createQueueTester,
  expectJobToFail,
  fake,
  getFakeQueue,
  isFaked,
  QueueTester,
  restore,
  runJob,
} from '../src/testing'

describe('Queue Testing Utilities', () => {
  describe('fake() / restore() / isFaked()', () => {
    afterEach(() => {
      restore()
    })

    it('should create a fake queue', () => {
      const fq = fake()
      expect(fq).toBeDefined()
      expect(isFaked()).toBe(true)
    })

    it('should return the fake queue via getFakeQueue()', () => {
      const fq = fake()
      expect(getFakeQueue()).toBe(fq)
    })

    it('should not be faked by default', () => {
      restore()
      expect(isFaked()).toBe(false)
      expect(getFakeQueue()).toBeNull()
    })

    it('should restore real queue behavior', () => {
      fake()
      expect(isFaked()).toBe(true)

      restore()
      expect(isFaked()).toBe(false)
      expect(getFakeQueue()).toBeNull()
    })
  })

  describe('FakeQueue', () => {
    let fq: ReturnType<typeof fake>

    beforeEach(() => {
      fq = fake()
    })

    afterEach(() => {
      restore()
    })

    describe('dispatch()', () => {
      it('should record dispatched jobs', () => {
        fq.dispatch('SendEmail', { to: 'user@test.com' })

        const dispatched = fq.dispatched()
        expect(dispatched).toHaveLength(1)
        expect(dispatched[0].name).toBe('SendEmail')
        expect(dispatched[0].data).toEqual({ to: 'user@test.com' })
        expect(dispatched[0].queue).toBe('default')
      })

      it('should dispatch to a specific queue', () => {
        fq.dispatch('SendEmail', { to: 'user@test.com' }, { queue: 'emails' })

        const dispatched = fq.dispatched()
        expect(dispatched[0].queue).toBe('emails')
      })

      it('should record dispatch timestamp', () => {
        const before = new Date()
        fq.dispatch('TestJob', {})
        const after = new Date()

        const dispatched = fq.dispatched()
        expect(dispatched[0].dispatchedAt.getTime()).toBeGreaterThanOrEqual(before.getTime())
        expect(dispatched[0].dispatchedAt.getTime()).toBeLessThanOrEqual(after.getTime())
      })

      it('should filter dispatched jobs by name', () => {
        fq.dispatch('JobA', { id: 1 })
        fq.dispatch('JobB', { id: 2 })
        fq.dispatch('JobA', { id: 3 })

        expect(fq.dispatched('JobA')).toHaveLength(2)
        expect(fq.dispatched('JobB')).toHaveLength(1)
        expect(fq.dispatched('JobC')).toHaveLength(0)
      })
    })

    describe('push()', () => {
      it('should record pushed jobs', () => {
        fq.push('DelayedJob', { data: 'test' })

        const pushed = fq.pushed()
        expect(pushed).toHaveLength(1)
        expect(pushed[0].name).toBe('DelayedJob')
      })

      it('should filter pushed jobs by name', () => {
        fq.push('JobA', { id: 1 })
        fq.push('JobB', { id: 2 })

        expect(fq.pushed('JobA')).toHaveLength(1)
        expect(fq.pushed('JobB')).toHaveLength(1)
      })
    })

    describe('assertions', () => {
      it('assertDispatched should pass when job was dispatched', () => {
        fq.dispatch('TestJob', { id: 1 })
        expect(() => fq.assertDispatched('TestJob')).not.toThrow()
      })

      it('assertDispatched should fail when job was not dispatched', () => {
        expect(() => fq.assertDispatched('MissingJob')).toThrow(
          'Expected job "MissingJob" to be dispatched',
        )
      })

      it('assertDispatched should support callback filter', () => {
        fq.dispatch('TestJob', { id: 1, type: 'a' })
        fq.dispatch('TestJob', { id: 2, type: 'b' })

        expect(() =>
          fq.assertDispatched('TestJob', j => j.data.type === 'b'),
        ).not.toThrow()

        expect(() =>
          fq.assertDispatched('TestJob', j => j.data.type === 'c'),
        ).toThrow('no matching jobs were found')
      })

      it('assertNotDispatched should pass when job was not dispatched', () => {
        expect(() => fq.assertNotDispatched('MissingJob')).not.toThrow()
      })

      it('assertNotDispatched should fail when job was dispatched', () => {
        fq.dispatch('TestJob', {})
        expect(() => fq.assertNotDispatched('TestJob')).toThrow(
          'Expected job "TestJob" to not be dispatched',
        )
      })

      it('assertDispatchedTimes should validate dispatch count', () => {
        fq.dispatch('TestJob', { round: 1 })
        fq.dispatch('TestJob', { round: 2 })
        fq.dispatch('TestJob', { round: 3 })

        expect(() => fq.assertDispatchedTimes('TestJob', 3)).not.toThrow()
        expect(() => fq.assertDispatchedTimes('TestJob', 2)).toThrow(
          'Expected job "TestJob" to be dispatched 2 time(s), but it was dispatched 3 time(s)',
        )
      })

      it('assertNothingDispatched should pass when queue is empty', () => {
        expect(() => fq.assertNothingDispatched()).not.toThrow()
      })

      it('assertNothingDispatched should fail when jobs were dispatched', () => {
        fq.dispatch('SomeJob', {})
        expect(() => fq.assertNothingDispatched()).toThrow(
          'Expected no jobs to be dispatched, but found: SomeJob',
        )
      })

      it('assertPushed should pass when job was pushed', () => {
        fq.push('TestJob', {})
        expect(() => fq.assertPushed('TestJob')).not.toThrow()
      })

      it('assertPushed should fail when job was not pushed', () => {
        expect(() => fq.assertPushed('MissingJob')).toThrow(
          'Expected job "MissingJob" to be pushed',
        )
      })

      it('assertPushedOn should validate queue name', () => {
        fq.push('EmailJob', {}, { queue: 'emails' })

        expect(() => fq.assertPushedOn('emails', 'EmailJob')).not.toThrow()
        expect(() => fq.assertPushedOn('default', 'EmailJob')).toThrow(
          'Expected job "EmailJob" to be pushed on queue "default"',
        )
      })
    })

    describe('processJob()', () => {
      it('should process a dispatched job', async () => {
        fq.dispatch('ProcessMe', { value: 42 })

        await fq.processJob('ProcessMe', async (data: any) => {
          expect(data.value).toBe(42)
          return { processed: true }
        })

        expect(fq.processed('ProcessMe')).toHaveLength(1)
      })

      it('should track failed jobs', async () => {
        fq.dispatch('FailMe', { bad: true })

        try {
          await fq.processJob('FailMe', async () => {
            throw new Error('Job failed!')
          })
        }
        catch {
          // expected
        }

        expect(fq.failed('FailMe')).toHaveLength(1)
        expect(fq.failed('FailMe')[0].error.message).toBe('Job failed!')
      })

      it('should throw when processing non-existent job', async () => {
        expect(
          fq.processJob('NonExistent', async () => {}),
        ).rejects.toThrow('No dispatched job found with name "NonExistent"')
      })
    })

    describe('reset()', () => {
      it('should clear all recorded jobs', () => {
        fq.dispatch('Job1', {})
        fq.push('Job2', {})

        fq.reset()

        expect(fq.dispatched()).toHaveLength(0)
        expect(fq.pushed()).toHaveLength(0)
        expect(fq.processed()).toHaveLength(0)
        expect(fq.failed()).toHaveLength(0)
      })
    })
  })

  describe('QueueTester', () => {
    let tester: QueueTester

    beforeEach(() => {
      tester = createQueueTester()
    })

    afterEach(() => {
      tester.cleanup()
    })

    it('should dispatch and assert via fluent API', () => {
      tester
        .dispatch('TestJob', { id: 1 })
        .assertDispatched('TestJob')
        .assertDispatchedTimes('TestJob', 1)
    })

    it('should push and assert not dispatched', () => {
      tester
        .push('DelayedJob', { delay: true })
        .assertNotDispatched('DelayedJob')
    })

    it('should support chained assertions', () => {
      tester
        .dispatch('JobA', {})
        .dispatch('JobB', {})
        .assertDispatched('JobA')
        .assertDispatched('JobB')
        .assertDispatchedTimes('JobA', 1)
        .assertDispatchedTimes('JobB', 1)
    })

    it('should reset and assert nothing dispatched', () => {
      tester
        .dispatch('TestJob', {})
        .reset()
        .assertNothingDispatched()
    })

    it('should return dispatched jobs', () => {
      tester.dispatch('TestJob', { id: 1 })

      const jobs = tester.dispatched('TestJob')
      expect(jobs).toHaveLength(1)
      expect(jobs[0].data).toEqual({ id: 1 })
    })
  })

  describe('runJob()', () => {
    it('should run a job module synchronously', async () => {
      const jobModule = {
        handle: async (data: { value: number }) => data.value * 2,
      }

      const result = await runJob(jobModule, { value: 21 })
      expect(result).toBe(42)
    })

    it('should handle void-returning jobs', async () => {
      let sideEffect = false
      const jobModule = {
        handle: async () => {
          sideEffect = true
        },
      }

      await runJob(jobModule, undefined)
      expect(sideEffect).toBe(true)
    })
  })

  describe('expectJobToFail()', () => {
    it('should pass when job throws', async () => {
      const jobModule = {
        handle: async () => {
          throw new Error('Intentional failure')
        },
      }

      const error = await expectJobToFail(jobModule, undefined)
      expect(error.message).toBe('Intentional failure')
    })

    it('should match expected error string', async () => {
      const jobModule = {
        handle: async () => {
          throw new Error('Database connection failed')
        },
      }

      await expectJobToFail(jobModule, undefined, 'Database connection')
    })

    it('should match expected error regex', async () => {
      const jobModule = {
        handle: async () => {
          throw new Error('Timeout after 5000ms')
        },
      }

      await expectJobToFail(jobModule, undefined, /Timeout after \d+ms/)
    })

    it('should fail when job succeeds unexpectedly', async () => {
      const jobModule = {
        handle: async () => 'success',
      }

      expect(
        expectJobToFail(jobModule, undefined),
      ).rejects.toThrow('Expected job to fail, but it succeeded')
    })

    it('should fail when error does not match expected string', async () => {
      const jobModule = {
        handle: async () => {
          throw new Error('Wrong error')
        },
      }

      expect(
        expectJobToFail(jobModule, undefined, 'Expected error'),
      ).rejects.toThrow('Expected error to contain "Expected error"')
    })
  })
})
