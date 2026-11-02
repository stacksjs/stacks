import { test } from 'bun:test'
import { assertIsolatedOk, runIsolated } from '@stacksjs/testing'

test('exists and unique use real SQLite rows and fail closed over HTTP on query errors', async () => {
  assertIsolatedOk(await runIsolated(`${import.meta.dir}/fixtures/database-rules.ts`, {
    envFile: false, preload: [], timeoutMs: 15_000,
    env: { DB_CONNECTION: 'sqlite', DB_DATABASE: ':memory:', DB_DATABASE_PATH: ':memory:' },
  }), 'database validation rules OK')
}, 20_000)
