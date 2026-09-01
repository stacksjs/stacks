/**
 * What `.withoutOverlapping()` / `.onOneServer()` do to the task's promise.
 *
 * The guarded body has to be async - a DB advisory lock can require a
 * round-trip while cron ticks are sync - and it used to be launched as a
 * detached `void (async () => {…})()`. Every caller expecting to await the task
 * got `undefined` instead, which broke three separate things at once
 * (stacksjs/stacks#2403):
 *
 *   - `withErrorHandler` never fired for a guarded task, because the runner's
 *     `if (result?.then) await result` had nothing to await and never saw the
 *     rejection. The framework's own docs put `.withoutOverlapping(30)` and
 *     `.withErrorHandler(...)` in the same worked example.
 *   - `Schedule.runNow()` resolved in ~0ms while the task was still running and
 *     about to throw, so any "run now" affordance reported green for a red job.
 *   - A lock-layer failure became an unhandled rejection from a detached
 *     promise, which terminates the process under Bun's default policy. A full
 *     disk or a read-only mount on a deployed box reaches it.
 *
 * So these are mostly about a guarded task behaving exactly like an unguarded
 * one, and each has the unguarded control beside it.
 */

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'bun:test'
import { Schedule } from '../src/schedule'

const directories: string[] = []

/** A writable lock directory, since these tests exercise the locking path. */
function useLockDir(path?: string): void {
  if (!path) {
    const directory = mkdtempSync(join(tmpdir(), 'stacks-scheduler-lock-'))
    directories.push(directory)
    path = directory
  }
  ;(Schedule as unknown as { lockDir: string }).lockDir = path
}

const originalLockDir = (Schedule as unknown as { lockDir: string }).lockDir

/** Register a task and wait for the deferred `start()` microtask to run. */
async function register(name: string, task: () => unknown, guarded: boolean): Promise<void> {
  const schedule = new Schedule(task as () => void)
  if (guarded) schedule.withoutOverlapping()
  // `yearly()` so no timer fires during the test; `runNow` drives it instead.
  schedule.withName(name).yearly()
  await new Promise(resolve => setTimeout(resolve, 0))
}

afterEach(() => {
  ;(Schedule as unknown as { lockDir: string }).lockDir = originalLockDir
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

describe('a guarded task that throws', () => {
  it('reaches withErrorHandler, exactly as an unguarded one does', async () => {
    useLockDir()
    const seen: string[] = []

    const guarded = new Schedule(() => { throw new Error('guarded boom') })
    guarded.withoutOverlapping().withName('GuardedThrows')
      .withErrorHandler(error => seen.push(`guarded:${error.message}`)).yearly()

    const plain = new Schedule(() => { throw new Error('plain boom') })
    plain.withName('PlainThrows')
      .withErrorHandler(error => seen.push(`plain:${error.message}`)).yearly()

    await new Promise(resolve => setTimeout(resolve, 0))
    await expect(Schedule.runNow('GuardedThrows')).rejects.toThrow('guarded boom')
    await expect(Schedule.runNow('PlainThrows')).rejects.toThrow('plain boom')

    // The control is the point: the handler fired for the plain task the whole
    // time, which is what made the guarded one's silence look like the task
    // simply working.
    expect(seen).toEqual(['guarded:guarded boom', 'plain:plain boom'])
  })

  it('rejects runNow() rather than reporting success', async () => {
    useLockDir()
    await register('GuardedRunNow', () => { throw new Error('still broken') }, true)

    await expect(Schedule.runNow('GuardedRunNow')).rejects.toThrow('still broken')
  })

  it('releases the lock, so the next run is not skipped as an overlap', async () => {
    // The release sits in a `finally`, and the throw path is the one that
    // matters: a lock left behind by a failing run would make every later run
    // skip, turning one visible failure into permanent silence.
    useLockDir()
    let runs = 0
    await register('GuardedReleases', () => { runs++; throw new Error('every time') }, true)

    await expect(Schedule.runNow('GuardedReleases')).rejects.toThrow('every time')
    await expect(Schedule.runNow('GuardedReleases')).rejects.toThrow('every time')

    expect(runs).toBe(2)
  })
})

describe('runNow() on a guarded task', () => {
  it('waits for the task instead of resolving past it', async () => {
    // The reported symptom was `RESOLVED in 0ms` while the task was still
    // running. Ordering is asserted rather than duration, which would be a
    // timing test.
    useLockDir()
    const order: string[] = []
    await register('GuardedSlow', async () => {
      await new Promise(resolve => setTimeout(resolve, 25))
      order.push('task finished')
    }, true)

    await Schedule.runNow('GuardedSlow')
    order.push('runNow returned')

    expect(order).toEqual(['task finished', 'runNow returned'])
  })

  it('resolves for a task that succeeds', async () => {
    // Returning the promise must not turn every guarded run into a rejection.
    useLockDir()
    let ran = 0
    await register('GuardedOk', () => { ran++ }, true)

    await expect(Schedule.runNow('GuardedOk')).resolves.toBeUndefined()
    expect(ran).toBe(1)
  })
})

describe('when the lock layer itself fails', () => {
  it('routes the failure to the error handler instead of detaching it', async () => {
    // `/dev/null` is a file, so creating a directory under it is ENOTDIR - the
    // shape a full disk or a read-only mount takes on a deployed box. This used
    // to escape as an unhandled rejection from a promise nothing held.
    useLockDir('/dev/null/stacks-locks')
    const seen: Error[] = []
    let ran = 0

    const guarded = new Schedule(() => { ran++ })
    guarded.withoutOverlapping().withName('LockUnwritable')
      .withErrorHandler(error => seen.push(error)).yearly()
    await new Promise(resolve => setTimeout(resolve, 0))

    await expect(Schedule.runNow('LockUnwritable')).rejects.toThrow(/ENOTDIR|ENOENT|EACCES/)

    expect(seen).toHaveLength(1)
    // Not being able to tell whether the task is already running is a failure
    // to run, so the task must not have run.
    expect(ran).toBe(0)
  })
})
