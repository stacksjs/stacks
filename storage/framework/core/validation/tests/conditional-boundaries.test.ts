import { test } from 'bun:test'
import { assertIsolatedOk, runIsolated } from '@stacksjs/testing'

test('conditional rules agree across HTTP actions and real SQLite model writes', async () => {
  assertIsolatedOk(await runIsolated(`${import.meta.dir}/fixtures/conditional-boundaries.ts`, {
    envFile: false, preload: [], timeoutMs: 20_000,
    env: { DB_CONNECTION: 'sqlite', DB_DATABASE: ':memory:', DB_DATABASE_PATH: ':memory:', APP_ENV: 'production', NODE_ENV: 'production' },
  }), 'conditional boundaries OK')
}, 25_000)
