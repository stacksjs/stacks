import { test } from 'bun:test'
import { assertIsolatedOk, runIsolated } from '@stacksjs/testing'
import { findChrome } from '@stacksjs/testing/browser'

for (let number = 1; number <= 16; number++) {
  const scenario = `E2E${String(number).padStart(2, '0')}`
  test(`${scenario} public HTTP client and resource contracts`, async () => {
    assertIsolatedOk(await runIsolated(`${import.meta.dir}/fixtures/http-regressions.ts`, {
      env: { API_HTTP_SCENARIO: scenario, APP_ENV: 'production', NODE_ENV: 'production', DB_CONNECTION: 'sqlite', DB_DATABASE_PATH: ':memory:' },
      envFile: false, preload: [], timeoutMs: 15_000,
    }), `${scenario} OK`)
  }, 20_000)
}

test('HTTP digest algorithms, replay bodies, response types and failure cleanup', async () => {
  assertIsolatedOk(await runIsolated(`${import.meta.dir}/fixtures/client-runtime.ts`, {
    envFile: false, preload: [], timeoutMs: 20_000,
  }), 'client runtime OK')
}, 25_000)

test.skipIf(!findChrome())('the bundled Fetcher passes the HTTP contracts in Chrome', async () => {
  assertIsolatedOk(await runIsolated(`${import.meta.dir}/fixtures/client-browser.ts`, {
    envFile: false, preload: [], timeoutMs: 40_000,
  }), 'client browser OK')
}, 45_000)
