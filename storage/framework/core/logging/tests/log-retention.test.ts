import { describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { DEFAULT_LOG_RETENTION_DAYS, pruneDailyLogs, resolveRetentionDays } from '../src/retention'

// stacksjs/stacks#3365. The logger writes one `stacks-YYYY-MM-DD.log` a day
// and nothing ever deleted one: a project's storage/logs held 120 of them,
// back eight months. Daily files past `retentionDays` are now removed.

const NOW = new Date('2026-11-23T12:00:00Z')

function day(daysAgo: number): string {
  return new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString().slice(0, 10)
}

function directoryWith(files: string[]): string {
  const directory = mkdtempSync(join(tmpdir(), 'stacks-log-retention-'))
  for (const file of files) writeFileSync(join(directory, file), 'x\n')
  return directory
}

describe('daily log retention', () => {
  test('deletes daily files older than the retention window, and nothing else', async () => {
    const keep = [`stacks-${day(0)}.log`, `stacks-${day(13)}.log`, `stacks-${day(14)}.log`, 'stacks.log', 'deployments.log', 'stacks-notes.log', `other-${day(200)}.log`]
    const old = [`stacks-${day(15)}.log`, `stacks-${day(120)}.log`]
    const directory = directoryWith([...keep, ...old])
    try {
      const deleted = await pruneDailyLogs(directory, 14, NOW)
      expect(deleted.sort()).toEqual([...old].sort())
      expect(readdirSync(directory).sort()).toEqual([...keep].sort())
    }
    finally { rmSync(directory, { recursive: true, force: true }) }
  })

  test('a retention of 0 keeps every file', async () => {
    const directory = directoryWith([`stacks-${day(400)}.log`])
    try {
      expect(await pruneDailyLogs(directory, 0, NOW)).toEqual([])
      expect(existsSync(join(directory, `stacks-${day(400)}.log`))).toBe(true)
    }
    finally { rmSync(directory, { recursive: true, force: true }) }
  })

  test('a missing directory is not an error', async () => {
    expect(await pruneDailyLogs(join(tmpdir(), 'stacks-no-such-logs-dir'), 14, NOW)).toEqual([])
  })

  test('the window comes from the env, then config/logging.ts, then 14 days', () => {
    expect(DEFAULT_LOG_RETENTION_DAYS).toBe(14)
    expect(resolveRetentionDays({})).toBe(14)
    expect(resolveRetentionDays({ cfg: 30 })).toBe(30)
    expect(resolveRetentionDays({ env: '7', cfg: 30 })).toBe(7)
    expect(resolveRetentionDays({ env: '0', cfg: 30 })).toBe(0)
    // Anything that is not a whole number of days is ignored, not obeyed.
    expect(resolveRetentionDays({ env: 'forever', cfg: 30 })).toBe(30)
    expect(resolveRetentionDays({ cfg: -3 })).toBe(14)
    expect(resolveRetentionDays({ cfg: 2.5 })).toBe(14)
  })
})

test('the logger prunes its own directory when it starts', async () => {
  const project = mkdtempSync(join(tmpdir(), 'stacks-log-retention-app-'))
  const logs = join(project, 'storage/logs')
  mkdirSync(logs, { recursive: true })
  writeFileSync(join(project, 'package.json'), JSON.stringify({ name: 'app' }))
  const today = new Date().toISOString().slice(0, 10)
  const stale = `stacks-${new Date(Date.now() - 40 * 86_400_000).toISOString().slice(0, 10)}.log`
  writeFileSync(join(logs, stale), 'old\n')
  try {
    const child = Bun.spawnSync([process.execPath, '-e', `
      const { log } = await import(${JSON.stringify(join(import.meta.dir, '../src/index.ts'))})
      await log.info('started')
      await Bun.sleep(300)
      process.exit(0)
    `], { cwd: project, env: { ...process.env, LOG_RETENTION_DAYS: '30', LOG_TO_FILE: 'true', NODE_ENV: 'development' }, stdout: 'pipe', stderr: 'pipe' })
    expect(child.exitCode, child.stderr.toString()).toBe(0)
    expect(existsSync(join(logs, stale))).toBe(false)
    expect(readdirSync(logs).some(file => file.includes(today))).toBe(true)
  }
  finally { rmSync(project, { recursive: true, force: true }) }
}, 30_000)
