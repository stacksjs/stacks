import { test } from 'bun:test'
import { assertIsolatedOk, runIsolated } from '@stacksjs/testing'
for (const scenario of ['env', 'config', 'clean']) {
  test(`filesystem ${scenario} retains literal data and owned boundaries`, async () => {
    assertIsolatedOk(await runIsolated(`${import.meta.dir}/fixtures/filesystem-lifecycle.ts`, { args: [scenario], envFile: false, preload: [], timeoutMs: 10_000 }), `filesystem ${scenario} OK`)
  }, 15_000)
}
