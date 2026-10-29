import { test } from 'bun:test'
import { join } from 'node:path'
import { disposablePostgresUrl, withDisposableDatabase } from '@stacksjs/testing/disposable-database'
import { assertIsolatedOk, runIsolated } from '@stacksjs/testing/isolated'

for (const dialect of ['sqlite', 'postgres'] as const) {
  test.skipIf(dialect === 'postgres' && !disposablePostgresUrl())(`${dialect}: competing invoice orders return a conflict and leave one complete sale`, () => withDisposableDatabase(dialect, async database => {
    const result = await runIsolated(join(import.meta.dir, 'fixtures/order-conflict.ts'), {
      env: { APP_ENV: 'test', ...database.env }, envFile: false, preload: [], timeoutMs: 25_000,
    })
    assertIsolatedOk(result, 'order conflicts OK')
  }, { prefix: 'stacks_order_conflict' }), 30_000)
}
