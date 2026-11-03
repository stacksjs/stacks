import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Schedule } from '../src/schedule'

// A missed slot is a run like any other: it goes through the guards a live
// tick goes through. runMissed() used to call the task directly, so a paused
// task caught up on boot, a between() window was ignored, and a slot ran
// while the same task was already running under withoutOverlapping().

const NOW = new Date('2026-06-15T10:05:30Z').getTime()
const realNow = Date.now.bind(Date)
const internals = Schedule as unknown as { lockDir: string, stateFile: string, activeLocks: Map<string, unknown> }
const saved = { lockDir: internals.lockDir, stateFile: internals.stateFile }
let directory = ''

beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), 'stacks-run-missed-'))
  internals.lockDir = join(directory, 'locks')
  internals.stateFile = join(directory, 'scheduler-state.json')
})
afterEach(() => { Date.now = realNow })
afterAll(() => {
  internals.lockDir = saved.lockDir
  internals.stateFile = saved.stateFile
  rmSync(directory, { recursive: true, force: true })
})

function everyMinute(name: string, task: () => void): Schedule {
  const schedule = new Schedule(task).withName(name)
  ;(schedule as unknown as { cronPattern: string }).cronPattern = '* * * * *'
  return schedule
}

describe('runMissed() keeps the live guards', () => {
  test('a paused task runs no missed slots', async () => {
    Date.now = () => NOW
    let calls = 0
    const schedule = everyMinute('paused-report', () => { calls++ })
    Schedule.setEnabled('paused-report', false)
    expect(await schedule.runMissed({ since: NOW - 5 * 60_000 })).toBe(0)
    expect(calls).toBe(0)
    Schedule.setEnabled('paused-report', true)
  })

  test('only slots inside the between() window run', async () => {
    Date.now = () => NOW
    const slots: number[] = []
    const schedule = everyMinute('campaign', () => { slots.push(Date.now()) })
      .between(new Date('2026-06-15T10:03:00Z'), new Date('2026-06-15T10:04:00Z'))
    expect(await schedule.runMissed({ since: NOW - 5 * 60_000 })).toBe(2)
    expect(slots).toHaveLength(2)
  })

  test('a slot does not run while the task already holds its overlap lock', async () => {
    Date.now = () => NOW
    let calls = 0
    const schedule = everyMinute('nightly-sync', () => { calls++ }).withoutOverlapping()
    internals.activeLocks.set('nightly-sync', { release: async () => {} })
    try {
      expect(await schedule.runMissed({ since: NOW - 3 * 60_000 })).toBe(0)
      expect(calls).toBe(0)
    }
    finally {
      internals.activeLocks.delete('nightly-sync')
    }
    expect(await schedule.runMissed({ since: NOW - 3 * 60_000 })).toBe(3)
    expect(calls).toBe(3)
  })
})
