import { assertIsolatedOk, runIsolated, withDisposableDatabase } from '@stacksjs/testing'
import { test } from 'bun:test'

for (const scenario of ['process-concurrency', 'dead-letter', 'scheduled-dispatch', 'circuit', 'poison', 'quarantine-hashes'] as const) {
  test(`${scenario} retains queue reliability under concurrency and failure`, async () => {
    await withDisposableDatabase('sqlite', async (database) => {
      const result = await runIsolated(`${import.meta.dir}/fixtures/reliability.ts`, {
        env: { ...database.env, APP_ENV: 'test', QUEUE_RELIABILITY_SCENARIO: scenario },
        envFile: false,
        preload: [],
        timeoutMs: 30_000,
      })
      assertIsolatedOk(result, `${scenario} OK`)
    })
  }, 40_000)
}
