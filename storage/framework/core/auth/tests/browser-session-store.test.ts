import { test } from 'bun:test'
import { join } from 'node:path'
import { withDisposableDatabase, disposablePostgresUrl } from '@stacksjs/testing/disposable-database'
import { assertIsolatedOk, runIsolated } from '@stacksjs/testing/isolated'

for (const dialect of ['sqlite', 'postgres'] as const) {
  test.skipIf(dialect === 'postgres' && !disposablePostgresUrl())(`${dialect}: durable browser credentials survive access expiry and restart without replayable session identifiers`, async () => {
    await withDisposableDatabase(dialect, async database => {
      for (const phase of ['login', 'resume']) {
        assertIsolatedOk(await runIsolated(join(import.meta.dir, 'fixtures/browser-session-store.ts'), {
          args: [phase],
          env: { ...database.env, APP_ENV: 'test', APP_KEY: 'owned-browser-session-fixture-key', STACKS_BROWSER_SESSION_DIRECTORY: database.directory },
          envFile: false, preload: [], timeoutMs: 30_000,
        }), `browser session ${phase} OK`)
      }
    }, { prefix: 'stacks_browser_session' })
  }, 90_000)
}
