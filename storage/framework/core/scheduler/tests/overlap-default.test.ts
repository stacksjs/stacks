import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { Schedule } from '../src/schedule'

// stacksjs/stacks#3364. The next tick started without waiting for the last,
// so a task slower than its interval ran on top of itself: two digests, two
// publishes of the same post. A tick is now skipped while the previous run of
// the same task is still going in this process, unless the task opts in to
// overlapping.

afterEach(async () => {
  await Schedule.gracefulShutdown()
})

async function captureInterval(register: () => void): Promise<() => Promise<void>> {
  const handle = setInterval(() => {}, 60_000)
  const interval = spyOn(globalThis, 'setInterval').mockReturnValue(handle)
  try {
    register()
    await Promise.resolve()
    const [callback] = interval.mock.calls[0] ?? []
    if (!callback)
      throw new Error('The schedule did not register an interval.')
    return async () => {
      callback()
      await new Promise<void>(resolve => setImmediate(resolve))
    }
  }
  finally {
    interval.mockRestore()
    clearInterval(handle)
  }
}

describe('a task slower than its interval', () => {
  test('does not overlap itself by default', async () => {
    const active = Promise.withResolvers<void>()
    const task = mock(() => active.promise)
    const tick = await captureInterval(() => {
      new Schedule(task).everySecond().withName('slow-default')
    })
    try {
      await tick()
      await tick()
      await tick()
      expect(task).toHaveBeenCalledTimes(1)
    }
    finally {
      active.resolve()
    }
  })

  test('overlaps when it says it may', async () => {
    const active = Promise.withResolvers<void>()
    const task = mock(() => active.promise)
    const tick = await captureInterval(() => {
      new Schedule(task).everySecond().allowOverlapping().withName('slow-overlapping')
    })
    try {
      await tick()
      await tick()
      await tick()
      expect(task).toHaveBeenCalledTimes(3)
    }
    finally {
      active.resolve()
    }
  })

  test('runNow can start during a tick and later ticks wait for both runs', async () => {
    const scheduled = Promise.withResolvers<void>()
    const manual = Promise.withResolvers<void>()
    const task = mock(() => Promise.resolve())
      .mockImplementationOnce(() => scheduled.promise)
      .mockImplementationOnce(() => manual.promise)
    const tick = await captureInterval(() => {
      new Schedule(task).everySecond().withName('slow-run-now')
    })
    let runNow: Promise<void> | undefined
    try {
      await tick()
      expect(task).toHaveBeenCalledTimes(1)
      runNow = Schedule.runNow('slow-run-now', { inProcess: true })
      expect(task).toHaveBeenCalledTimes(2)

      scheduled.resolve()
      await scheduled.promise
      await tick()
      expect(task).toHaveBeenCalledTimes(2)

      manual.resolve()
      await runNow
      await tick()
      expect(task).toHaveBeenCalledTimes(3)
    }
    finally {
      scheduled.resolve()
      manual.resolve()
      await runNow
    }
  })
})
