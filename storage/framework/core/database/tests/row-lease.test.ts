import { test } from 'bun:test'
import { assertIsolatedOk, runIsolated, withDisposableDatabase } from '@stacksjs/testing'
import { disposablePostgresUrl } from '@stacksjs/testing/disposable-database'
for (const dialect of ['sqlite', 'postgres'] as const) {
  test.skipIf(dialect === 'postgres' && !disposablePostgresUrl())(`${dialect} row leases exclude another process and fence expired owners`, async () => {
    await withDisposableDatabase(dialect, async database => {
      assertIsolatedOk(await runIsolated(`${import.meta.dir}/fixtures/row-lease.ts`, { env: { ...database.env, APP_ENV: 'test' }, envFile: false, preload: [] }), 'row leases OK')
    })
  }, 30000)
}
