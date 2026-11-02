import { test } from 'bun:test'
import { assertIsolatedOk, runIsolated } from '@stacksjs/testing'
import { findChrome } from '@stacksjs/testing/browser'

test('generated clients and consumer types satisfy all 20 audited contracts', async () => {
  assertIsolatedOk(await runIsolated(`${import.meta.dir}/fixtures/generated-client-contracts.ts`, {
    envFile: false, preload: [], timeoutMs: 30_000,
  }), '20 generated client contracts OK')
}, 35_000)


test.skipIf(!findChrome())('standalone generated clients satisfy the HTTP contracts in Chrome', async () => {
  assertIsolatedOk(await runIsolated(`${import.meta.dir}/fixtures/generated-client-browser.ts`, {
    envFile: false, preload: [], timeoutMs: 40_000,
  }), 'generated client browser contracts OK')
}, 45_000)
