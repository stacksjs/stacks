import { expect, test } from 'bun:test'
import { join } from 'node:path'
import { disposablePostgresUrl, withDisposableDatabase } from '@stacksjs/testing/disposable-database'
import { assertIsolatedOk, runIsolated } from '@stacksjs/testing/isolated'

for (const dialect of ['sqlite', 'postgres'] as const) {
  test.skipIf(dialect === 'postgres' && !disposablePostgresUrl())(`${dialect}: setup is atomic and recovery codes are private, owner-bound and single-use`, () => withDisposableDatabase(dialect, async database => {
    const result = await runIsolated(join(import.meta.dir, 'fixtures/two-factor-backup-codes.ts'), {
      env: { ...database.env, APP_ENV: 'test', DB_QUERY_LOGGING_ENABLED: 'false' }, envFile: false, preload: [], timeoutMs: 30000,
    })
    assertIsolatedOk(result, 'two-factor backup codes OK')
  }, { prefix: 'stacks_factor_backup' }), 40000)
}
