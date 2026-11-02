import { assertIsolatedOk, disposablePostgresUrl, runIsolated, withDisposableDatabase } from '@stacksjs/testing'
import { test } from 'bun:test'

for (const dialect of ['sqlite', 'postgres'] as const) {
  test.skipIf(dialect === 'postgres' && !disposablePostgresUrl())(`${dialect}: keyset pages keep tied, nullable and joined rows reachable`, () => withDisposableDatabase(dialect, async (database) => {
    assertIsolatedOk(await runIsolated(`${import.meta.dir}/fixtures/keyset-pagination.ts`, {
      env: { ...database.env, APP_ENV: 'test' }, envFile: false, preload: [], timeoutMs: 20_000,
    }), 'keyset pages OK')
  }), 30_000)
}
