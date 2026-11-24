import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Schedule } from '../src/schedule'

// stacksjs/stacks#3364. There was no record of when a task last ran or
// whether it failed: an operator asking "did the 03:15 prune run?" had only
// logs. Each run's start, end, outcome and error are now kept per task, in a
// file beside the pause state, so every process sees the same history.

const internals = Schedule as unknown as { historyFile: string }
const saved = { historyFile: '' }
let directory = ''

beforeAll(() => {
  saved.historyFile = internals.historyFile
  directory = mkdtempSync(join(tmpdir(), 'stacks-scheduler-history-'))
  internals.historyFile = join(directory, 'scheduler-history.json')
})
afterEach(async () => { await Schedule.gracefulShutdown({ timeoutMs: 100 }) })
afterAll(() => {
  internals.historyFile = saved.historyFile
  rmSync(directory, { recursive: true, force: true })
})

describe('run history', () => {
  test('records a successful run', async () => {
    new Schedule(() => {}).hourly().withName('history-ok')
    await Promise.resolve()
    const before = Date.now()
    await Schedule.runNow('history-ok')
    const run = Schedule.lastRuns()['history-ok']!
    expect(run.status).toBe('success')
    expect(Date.parse(run.startedAt)).toBeGreaterThanOrEqual(before - 5)
    expect(Date.parse(run.finishedAt!)).toBeGreaterThanOrEqual(Date.parse(run.startedAt))
    expect(run.durationMs).toBeGreaterThanOrEqual(0)
    expect(run.error).toBeUndefined()
    expect(existsSync(internals.historyFile)).toBe(true)
  })

  test('records a failure with its message, trimmed, and keeps the last success', async () => {
    new Schedule(() => { throw new Error(`boom ${'x'.repeat(2000)}`) }).hourly().withName('history-ok').withErrorHandler(() => {})
    await Promise.resolve()
    await Schedule.runNow('history-ok').catch(() => {})
    const run = Schedule.lastRuns()['history-ok']!
    expect(run.status).toBe('failed')
    expect(run.error!.startsWith('boom ')).toBe(true)
    expect(run.error!.length).toBeLessThanOrEqual(500)
    expect(run.lastSuccessAt).toBeDefined()
  })

  test('is shown by listJobs and schedule:list', async () => {
    new Schedule(() => {}).hourly().withName('history-listed')
    await Promise.resolve()
    await Schedule.runNow('history-listed')
    const listed = Schedule.listJobs().find(job => job.name === 'history-listed')
    expect(listed?.lastRun?.status).toBe('success')
    const command = readFileSync(join(import.meta.dir, '../../buddy/src/commands/schedule.ts'), 'utf8')
    expect(command).toContain('LAST RUN')
  })

  test('a missing or corrupt history file reads as empty', () => {
    const previous = internals.historyFile
    internals.historyFile = join(directory, 'nope', 'history.json')
    expect(Schedule.lastRuns()).toEqual({})
    internals.historyFile = previous
  })
})

test('a test process never writes the project\'s real history', () => {
  const { frameworkPath } = require('@stacksjs/path') as typeof import('@stacksjs/path')
  expect(saved.historyFile).not.toBe(frameworkPath('runtime/scheduler-history.json'))
  expect(saved.historyFile).toBe(join(tmpdir(), 'stacks-scheduler-history-test.json'))
})
