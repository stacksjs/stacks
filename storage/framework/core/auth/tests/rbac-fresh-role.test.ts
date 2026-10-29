import { test } from 'bun:test'
import { withDisposableDatabase } from '../../testing/src/disposable-database'
import { assertIsolatedOk, runIsolated } from '../../testing/src/isolated'

test('fresh role checks observe role changes made by another worker', async () => {
  await withDisposableDatabase('sqlite', async database => {
    const result = await runIsolated(`${import.meta.dir}/fixtures/rbac-fresh-role.ts`, {
      env: { ...database.env, APP_ENV: 'test' },
      envFile: false,
      preload: [],
      timeoutMs: 20_000,
    })
    assertIsolatedOk(result, 'fresh role checks OK')
  })
}, 25_000)
