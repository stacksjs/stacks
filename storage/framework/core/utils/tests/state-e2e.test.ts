import { test } from 'bun:test'
import { assertIsolatedOk, runIsolated } from '@stacksjs/testing'
import { findChrome } from '@stacksjs/testing/browser'

test('HTTP consumers round-trip exact SQL cursors, snapshots, cache keys and storage', async () => {
  assertIsolatedOk(await runIsolated(`${import.meta.dir}/fixtures/state-http.ts`, { envFile: false, preload: [], timeoutMs: 30_000 }), 'utility state HTTP OK')
}, 35_000)

test.skipIf(!findChrome())('real Chrome consumes the HTTP API and runs browser utility callbacks', async () => {
  // Allow the native startup, navigation, assertion and cleanup deadlines to finish.
  assertIsolatedOk(await runIsolated(`${import.meta.dir}/fixtures/state-browser.ts`, { envFile: false, preload: [], timeoutMs: 150_000 }), 'utility state browser OK')
}, 155_000)
