import { describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import process from 'node:process'
import { Glob } from 'bun'

// stacksjs/stacks#3385. `schema.date()` is a calendar date, which becomes a
// SQL `date` on Postgres and MySQL and drops the time of day; SQLite stores
// it as TEXT, so a SQLite app never sees the loss. An attribute that records
// when something happened is an instant and validates with
// `schema.timestamp()`, which is `timestamp` on Postgres, DATETIME on MySQL.

const MODELS = join(import.meta.dir, '../../../defaults/app/Models')

interface Attribute { validation?: { rule?: { name?: string } } }

async function rulesByAttribute(): Promise<Array<{ model: string, attribute: string, rule: string | undefined }>> {
  const found: Array<{ model: string, attribute: string, rule: string | undefined }> = []
  for (const file of new Glob('**/*.ts').scanSync(MODELS)) {
    const model = (await import(join(MODELS, file))).default as { attributes?: Record<string, Attribute> } | undefined
    for (const [attribute, options] of Object.entries(model?.attributes ?? {}))
      found.push({ model: relative(MODELS, join(MODELS, file)).replace(/\.ts$/, ''), attribute, rule: options?.validation?.rule?.name })
  }
  return found
}

describe('default model instants (#3385)', () => {
  test('no attribute named for a moment validates as a calendar date', async () => {
    const all = await rulesByAttribute()
    // Guards against the property below passing because nothing loaded.
    expect(all.length).toBeGreaterThan(500)
    const offenders = all
      .filter(({ attribute }) => /(?:At|_at)$/.test(attribute))
      .filter(({ rule }) => rule === 'date')
      .map(({ model, attribute }) => `${model}.${attribute}`)
    expect(offenders).toEqual([])
  })

  test('coupon validity stays a calendar date, deliberately', async () => {
    // Its factory writes YYYY-MM-DD: a coupon runs from one day to another.
    const coupon = (await rulesByAttribute()).filter(({ model }) => model === 'commerce/Coupon')
    expect(coupon.find(({ attribute }) => attribute === 'startDate')?.rule).toBe('date')
    expect(coupon.find(({ attribute }) => attribute === 'endDate')?.rule).toBe('date')
  })

  test('FailedJob.failed_at generates a timestamp column on Postgres', async () => {
    const root = mkdtempSync(join(tmpdir(), 'stacks-instant-columns-'))
    try {
      const config = join(root, 'bunfig.toml')
      writeFileSync(config, 'preload = []\n')
      const child = Bun.spawn([process.execPath, `--config=${config}`, '--no-env-file', `${import.meta.dir}/fixtures/instant-columns-postgres.ts`], {
        cwd: root,
        env: { ...process.env, APP_ENV: 'test', DB_CONNECTION: 'sqlite', DB_DATABASE_PATH: join(root, 'app.sqlite') },
        stdout: 'pipe',
        stderr: 'pipe',
      })
      const watchdog = setTimeout(() => child.kill(), 50_000)
      try {
        const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
        expect(code, `${stdout}\n${stderr}`).toBe(0)
        expect(stdout).toContain('"failed_at" timestamp')
        expect(stdout).not.toContain('"failed_at" date')
      }
      finally {
        clearTimeout(watchdog)
        child.kill()
      }
    }
    finally { rmSync(root, { recursive: true, force: true }) }
  }, 60_000)
})
