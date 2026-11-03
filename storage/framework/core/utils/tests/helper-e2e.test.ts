import { test } from 'bun:test'
import { assertIsolatedOk, runIsolated } from '@stacksjs/testing'
import { findChrome } from '@stacksjs/testing/browser'

test.skipIf(!findChrome())('real Chrome verifies observer change detection and callback recovery', async () => {
  assertIsolatedOk(await runIsolated(`${import.meta.dir}/fixtures/helper-browser.ts`, { envFile: false, preload: [], timeoutMs: 150_000 }), 'helper browser OK')
}, 155_000)


test('HTTP consumers retain file boundaries, macro isolation, graph data and retry limits', async () => {
  assertIsolatedOk(await runIsolated(`${import.meta.dir}/fixtures/helper-http.ts`, { envFile: false, preload: [], timeoutMs: 30_000 }), 'helper HTTP OK')
}, 35_000)
