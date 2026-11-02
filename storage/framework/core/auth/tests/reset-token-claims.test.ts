import { test } from 'bun:test'
import { join } from 'node:path'
import { withDisposableDatabase, disposablePostgresUrl } from '@stacksjs/testing/disposable-database'
import { assertIsolatedOk, runIsolated } from '@stacksjs/testing/isolated'

for (const dialect of ['sqlite', 'postgres'] as const) {
  test.skipIf(dialect === 'postgres' && !disposablePostgresUrl())(`${dialect}: indexed reset tokens are single-use and rollback preserves recovery`, async () => {
    await withDisposableDatabase(dialect, async (database) => {
      assertIsolatedOk(await runIsolated(join(import.meta.dir, 'fixtures/reset-token-claims.ts'), {
        env: { APP_ENV: 'test', ...database.env }, envFile: false, preload: [], timeoutMs: 20_000,
      }), 'reset token claims OK')
    }, { prefix: 'stacks_claim' })
  }, 25_000)
}
