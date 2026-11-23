import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { devSchedulerEnabled, hasScheduledWork } from '../src/commands/dev-scheduler'

// stacksjs/stacks#3366: `buddy dev` never started the scheduler, so scheduled
// work did not run during local use and nothing said a second command was
// needed. It is on by default and can be turned off.
describe('the dev scheduler', () => {
  test('runs by default when the app schedules something', () => {
    expect(devSchedulerEnabled({ hasScheduledWork: true })).toBe(true)
    expect(devSchedulerEnabled({ flag: true, env: '1', hasScheduledWork: true })).toBe(true)
  })

  test('--no-schedule and STACKS_DEV_SCHEDULE=0 turn it off', () => {
    expect(devSchedulerEnabled({ flag: false, hasScheduledWork: true })).toBe(false)
    for (const env of ['0', 'false', 'OFF', ' no '])
      expect(devSchedulerEnabled({ env, hasScheduledWork: true })).toBe(false)
  })

  test('starts nothing for an app with nothing to schedule', () => {
    expect(devSchedulerEnabled({ hasScheduledWork: false })).toBe(false)
  })

  test('an app schedules work through app/Scheduler.ts or a job', () => {
    const root = mkdtempSync(join(tmpdir(), 'stacks-dev-scheduler-'))
    try {
      expect(hasScheduledWork(root)).toBe(false)
      mkdirSync(join(root, 'app/Jobs'), { recursive: true })
      expect(hasScheduledWork(root)).toBe(false)
      writeFileSync(join(root, 'app/Jobs/SendDigest.ts'), 'export default { rate: "@daily" }')
      expect(hasScheduledWork(root)).toBe(true)
      rmSync(join(root, 'app/Jobs'), { recursive: true })
      writeFileSync(join(root, 'app/Scheduler.ts'), 'export default () => {}')
      expect(hasScheduledWork(root)).toBe(true)
    }
    finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('buddy dev starts it beside the servers and offers the opt-out', () => {
    const source = readFileSync(join(import.meta.dir, '../src/commands/dev.ts'), 'utf8')
    expect(source).toContain(`.option('--no-schedule'`)
    expect(source).toContain('runScheduleDevServer(')
    expect(source).toContain('devSchedulerEnabled(')
  })
})
