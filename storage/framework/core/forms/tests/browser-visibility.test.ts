import { test } from 'bun:test'
import { assertIsolatedOk, runIsolated } from '@stacksjs/testing'
import { findChrome } from '@stacksjs/testing/browser'

test.skipIf(!findChrome())('the real STX form restores required fields when their controller becomes hidden', async () => {
  assertIsolatedOk(await runIsolated(`${import.meta.dir}/fixtures/browser-visibility.ts`, { envFile: false, preload: [], timeoutMs: 45_000 }), 'browser visibility OK')
}, 55_000)
