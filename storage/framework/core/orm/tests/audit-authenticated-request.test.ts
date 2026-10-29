import { test } from 'bun:test'
import { withDisposableDatabase } from '../../testing/src/disposable-database'
import { assertIsolatedOk, runIsolated } from '../../testing/src/isolated'

test('model audit and activity trails attribute authenticated writes', async () => {
  await withDisposableDatabase('sqlite', async database => {
    const result = await runIsolated(`${import.meta.dir}/fixtures/audit-authenticated-request.ts`, {
      env: { ...database.env, APP_ENV: 'test' },
      envFile: false,
      preload: [],
      timeoutMs: 20_000,
    })
    assertIsolatedOk(result, 'authenticated audit trails OK')
  })
}, 25_000)
