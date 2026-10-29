import { test } from 'bun:test'
import { disposablePostgresUrl, withDisposableDatabase } from '../../testing/src/disposable-database'
import { assertIsolatedOk, runIsolated } from '../../testing/src/isolated'

for (const dialect of ['sqlite', 'postgres'] as const) {
 test.skipIf(dialect === 'postgres' && !disposablePostgresUrl())('support viewing authenticates the original session and rechecks live authority', async () => {
  await withDisposableDatabase(dialect, async database => {
    const result = await runIsolated(`${import.meta.dir}/fixtures/impersonation-auth.ts`, {
      env: { ...database.env, APP_ENV: 'test' }, envFile: false, preload: [], timeoutMs: 20_000,
    })
    assertIsolatedOk(result, 'impersonation authentication OK')
  })
}, 25_000)

}
