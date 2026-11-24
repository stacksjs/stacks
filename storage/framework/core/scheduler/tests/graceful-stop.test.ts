import { afterEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { Schedule } from '../src/schedule'

// stacksjs/stacks#3364. gracefulShutdown() stopped the timers and returned
// while jobs were still running, and nothing handled SIGTERM, so a deploy
// killed a job halfway through. It now waits for running jobs, up to a limit,
// and the scheduler process stops that way on SIGTERM and SIGINT.

afterEach(async () => {
  await Schedule.gracefulShutdown({ timeoutMs: 100 })
})

describe('gracefulShutdown', () => {
  test('waits for a running job to finish', async () => {
    let finished = false
    new Schedule(async () => {
      await Bun.sleep(1200)
      finished = true
    }).everySecond().withName('finishing-job')
    await Bun.sleep(1100)
    await Schedule.gracefulShutdown()
    expect(finished).toBe(true)
  }, 10_000)

  test('gives up after its time limit, and says which jobs were still running', async () => {
    new Schedule(async () => { await Bun.sleep(5000) }).everySecond().withName('stuck-job')
    await Bun.sleep(1100)
    const started = Date.now()
    const result = await Schedule.gracefulShutdown({ timeoutMs: 300 })
    expect(Date.now() - started).toBeLessThan(1500)
    expect(result.unfinished).toEqual(['stuck-job'])
  }, 10_000)
})

test('SIGTERM lets a running job finish before the scheduler exits', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'stacks-scheduler-sigterm-'))
  const marker = join(directory, 'job.log')
  try {
    const child = Bun.spawn([process.execPath, '-e', `
      import { appendFileSync } from 'node:fs'
      const { Schedule } = await import(${JSON.stringify(join(import.meta.dir, '../src/schedule.ts'))})
      Schedule.stopOnSignals()
      new Schedule(async () => {
        appendFileSync(${JSON.stringify(marker)}, 'started\\n')
        await Bun.sleep(1500)
        appendFileSync(${JSON.stringify(marker)}, 'finished\\n')
      }).everySecond().withName('sigterm-job')
      setInterval(() => {}, 1000)
    `], { stdout: 'pipe', stderr: 'pipe', env: { ...process.env, APP_ENV: 'test' } })
    for (let i = 0; i < 60 && !(existsSync(marker) && readFileSync(marker, 'utf8').includes('started')); i++)
      await Bun.sleep(100)
    child.kill('SIGTERM')
    const code = await child.exited
    expect(readFileSync(marker, 'utf8')).toBe('started\nfinished\n')
    expect(code).toBe(0)
  }
  finally { rmSync(directory, { recursive: true, force: true }) }
}, 20_000)

test('runScheduler installs the signal handling before it registers anything', () => {
  const source = readFileSync(join(import.meta.dir, '../src/run.ts'), 'utf8')
  const signals = source.indexOf('schedule.stopOnSignals()')
  expect(signals).toBeGreaterThan(-1)
  expect(signals).toBeLessThan(source.indexOf('await runSchedulerInstance()'))
})
