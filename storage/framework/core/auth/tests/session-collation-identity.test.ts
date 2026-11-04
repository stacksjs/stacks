import { test } from 'bun:test'
import { join } from 'node:path'
import { withDisposableDatabase } from '@stacksjs/testing/disposable-database'
import { assertIsolatedOk, runIsolated } from '@stacksjs/testing/isolated'

test('session credentials remain byte-sensitive with a case-insensitive database collation', async () => {
  await withDisposableDatabase('sqlite', async database => {
    assertIsolatedOk(await runIsolated(join(import.meta.dir, 'fixtures/session-collation-identity.ts'), {
      env: { ...database.env, APP_ENV: 'test', STACKS_SESSION_COLLATION_DIRECTORY: database.directory }, envFile: false, preload: [], timeoutMs: 15_000,
    }), 'exact session collation identity OK')
  }, { prefix: 'stacks_session_collation' })
}, 20_000)
