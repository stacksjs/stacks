import { afterEach, describe, expect, test } from 'bun:test'
import { Schedule } from '../src/schedule'

// stacksjs/stacks#3364. The next tick started without waiting for the last,
// so a task slower than its interval ran on top of itself: two digests, two
// publishes of the same post. A tick is now skipped while the previous run of
// the same task is still going in this process, unless the task opts in to
// overlapping.

afterEach(async () => {
  await Schedule.gracefulShutdown()
})

/** A task that takes `ms` and counts how many runs started. */
function slowTask(ms: number): { task: () => Promise<void>, started: () => number } {
  let started = 0
  return {
    task: async () => {
      started++
      await Bun.sleep(ms)
    },
    started: () => started,
  }
}

describe('a task slower than its interval', () => {
  test('does not overlap itself by default', async () => {
    const probe = slowTask(2500)
    new Schedule(probe.task).everySecond().withName('slow-default')
    await Bun.sleep(3300)
    expect(probe.started()).toBe(1)
  }, 10_000)

  test('overlaps when it says it may', async () => {
    const probe = slowTask(2500)
    new Schedule(probe.task).everySecond().allowOverlapping().withName('slow-overlapping')
    await Bun.sleep(3300)
    expect(probe.started()).toBeGreaterThanOrEqual(3)
  }, 10_000)

  test('runNow still runs while a tick is in progress', async () => {
    const probe = slowTask(2500)
    new Schedule(probe.task).everySecond().withName('slow-run-now')
    await Bun.sleep(1300)
    expect(probe.started()).toBe(1)
    await Schedule.runNow('slow-run-now', { inProcess: true })
    expect(probe.started()).toBe(2)
  }, 10_000)
})
