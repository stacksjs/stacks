import { test } from 'bun:test'
import { assertIsolatedOk, runIsolated } from '@stacksjs/testing'

test('validation, model and HTTP boundaries reject the audited bypasses', async () => {
  assertIsolatedOk(await runIsolated(`${import.meta.dir}/fixtures/boundary-contracts.ts`, {
    envFile: false, preload: [], timeoutMs: 30_000,
    env: { DB_CONNECTION: 'sqlite', DB_DATABASE: ':memory:', DB_DATABASE_PATH: ':memory:', APP_ENV: 'production', NODE_ENV: 'production' },
  }), 'validation boundary contracts OK')
}, 35_000)


test('router actions and ORM write validation preserve single evaluation and request isolation', async () => {
  assertIsolatedOk(await runIsolated(`${import.meta.dir}/fixtures/framework-boundaries.ts`, {
    envFile: false, preload: [], timeoutMs: 20_000,
    env: { DB_CONNECTION: 'sqlite', DB_DATABASE: ':memory:', DB_DATABASE_PATH: ':memory:', APP_ENV: 'production', NODE_ENV: 'production' },
  }), 'framework validation boundaries OK')
}, 25_000)
