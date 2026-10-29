import { test } from 'bun:test'
import { join } from 'node:path'
import { disposablePostgresUrl, withDisposableDatabase } from '../src/disposable-database'
import { assertIsolatedOk, runIsolated } from '../src/isolated'

for (const dialect of ['sqlite', 'postgres'] as const) {
  test.skipIf(dialect === 'postgres' && !disposablePostgresUrl())(`${dialect}: test schema keeps constraints and rolls back a failed batch`, () => withDisposableDatabase(dialect, async database => {
    const result = await runIsolated(join(import.meta.dir, 'fixtures/apply-schema.ts'), {
      env: { APP_ENV: 'test', NODE_ENV: 'test', ...database.env }, envFile: false, preload: [], timeoutMs: 30_000,
    })
    assertIsolatedOk(result, 'atomic test schema OK')
  }, { prefix: 'stacks_test_schema' }), 40_000)
}
