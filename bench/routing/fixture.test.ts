import { Database } from 'bun:sqlite'
import { expect, it } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { assertFixtureQueryCount, assertFixtureQueryLogged, createFixture, FIXTURE_ROWS, resetFixtureLogs } from './fixture'

it('supports real query logging in the isolated benchmark database', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'stacks-routing-fixture-'))
  const file = join(dir, 'bench.sqlite')
  try {
    createFixture(file)
    const loggingReady = assertFixtureQueryLogged(file)
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
      loggingReady,
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

it('rejects missing, failed, and unrelated query logs before benchmarking', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'stacks-routing-log-guard-'))
  const file = join(dir, 'bench.sqlite')
  try {
    createFixture(file)
    await expect(assertFixtureQueryLogged(file, 20)).rejects.toThrow('was not persisted')
    const db = new Database(file)
    try {
      db.run(`INSERT INTO query_logs (query, status, error, executed_at) VALUES
        ('SELECT * FROM bench_items', 'failed', 'database error', '2026-09-05T00:00:00'),
        ('SELECT * FROM other_items', 'completed', NULL, '2026-09-05T00:00:00'),
        ('SELECT * FROM benchXitems', 'completed', NULL, '2026-09-05T00:00:00'),
        ('INSERT INTO bench_items VALUES (1)', 'completed', NULL, '2026-09-05T00:00:00')`)
      await expect(assertFixtureQueryLogged(file, 20)).rejects.toThrow('was not persisted')
      db.run(`INSERT INTO query_logs (query, status, executed_at)
        VALUES ('SELECT * FROM bench_items', 'slow', '2026-09-05T00:00:00')`)
      await assertFixtureQueryLogged(file, 20)
    }
    finally {
      db.close()
    }
  }
  finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

it('verifies every loaded query, rejecting partial or duplicate persistence', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'stacks-routing-log-count-'))
  const file = join(dir, 'bench.sqlite')
  try {
    createFixture(file)
    const db = new Database(file)
    try {
      const insert = db.prepare(`INSERT INTO query_logs (query, status, error, executed_at)
        VALUES (?, ?, ?, '2026-09-05T00:00:00')`)
      insert.run('SELECT id FROM bench_items', 'completed', null)
      // A single successful parity probe cannot detect lost logs under load.
      await assertFixtureQueryLogged(file)
      await expect(assertFixtureQueryCount(file, 2, 20)).rejects.toThrow('expected 2, found 1')
      insert.run('SELECT id FROM bench_items', 'failed', 'query failed')
      insert.run('SELECT id FROM benchXitems', 'completed', null)
      insert.run('INSERT INTO bench_items VALUES (1)', 'completed', null)
      await expect(assertFixtureQueryCount(file, 2, 20)).rejects.toThrow('expected 2, found 1')
      const deferred = assertFixtureQueryCount(file, 2)
      insert.run('SELECT id FROM bench_items', 'slow', null)
      expect(await deferred).toBe(2)
      insert.run('SELECT id FROM bench_items', 'completed', null)
      await expect(assertFixtureQueryCount(file, 2, 20)).rejects.toThrow('expected 2, found 3')
    }
    finally {
      db.close()
    }
  }
  finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
