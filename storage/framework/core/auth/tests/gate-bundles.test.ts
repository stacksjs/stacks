import { expect, test } from 'bun:test'
import { assertIsolatedOk, runIsolated } from '../../testing/src/isolated'

for (const mode of ['registry', 'response', 'incompatible'] as const) {
  // CI builds runtime packages before core tests, including the published dist.
  for (const entry of ['source', 'dist'] as const) {
    test(`native Gate ${entry} ${mode} survives independent application bundles`, async () => {
      const result = await runIsolated(`${import.meta.dir}/fixtures/gate-bundles.ts`, {
        args: [mode, entry],
        inheritEnv: false,
        envFile: false,
        bunfig: `${import.meta.dir}/fixtures/gate-bundles.toml`,
        timeoutMs: 20_000,
      })
      assertIsolatedOk(result, `gate bundles ${mode} passed`)
      expect(result.code).toBe(0)
    }, 25_000)
  }
}
