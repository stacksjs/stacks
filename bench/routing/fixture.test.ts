import { Database } from 'bun:sqlite'
import { expect, it } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createFixture, FIXTURE_ROWS, resetFixtureLogs } from './fixture'

it('supports real query logging in the isolated benchmark database', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'stacks-routing-fixture-'))
  const file = join(dir, 'bench.sqlite')
  try {
    createFixture(file)
    const child = Bun.spawn([
      process.execPath,
      `--config=${join(import.meta.dir, 'bunfig.toml')}`,
      join(import.meta.dir, 'fixtures/query-logging.ts'),
      file,
    ], {
      env: { ...process.env, APP_ENV: 'test', DB_CONNECTION: 'sqlite', DB_DATABASE_PATH: file, DB_QUERY_LOGGING_ENABLED: 'true' },
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ])
    expect(exitCode, stderr).toBe(0)
    expect(stdout).toContain('fixture-query-logging-ok')

    const db = new Database(file)
    try {
      expect(db.query('SELECT COUNT(*) AS count FROM bench_items').get()).toEqual({ count: FIXTURE_ROWS })
      expect(db.query('SELECT status FROM query_logs').all()).toEqual([{ status: 'completed' }])
    }
    finally {
      db.close()
    }
    resetFixtureLogs(file)
    const reset = new Database(file)
    try {
      expect(reset.query('SELECT COUNT(*) AS count FROM query_logs').get()).toEqual({ count: 0 })
      expect(reset.query('SELECT COUNT(*) AS count FROM bench_items').get()).toEqual({ count: FIXTURE_ROWS })
      expect(reset.query('SELECT * FROM bench_items WHERE id = 1').get()).toEqual({ id: 1, name: 'item-1' })
      expect(reset.query("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'query_logs' ORDER BY name").all()).toEqual([
        { name: 'query_logs_duration_index' },
        { name: 'query_logs_executed_at_index' },
        { name: 'query_logs_status_index' },
      ])
    }
    finally {
      reset.close()
    }
  }
  finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
