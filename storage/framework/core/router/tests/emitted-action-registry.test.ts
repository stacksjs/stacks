import { test } from 'bun:test'
import { assertIsolatedOk, runIsolated } from '../../testing/src/isolated'

for (const mode of ['source', 'emitted'] as const) {
  for (const nativeRoutes of ['false', 'true'] as const) {
    test(`native string Actions resolve ${mode} files with native routes ${nativeRoutes}`, async () => {
      const result = await runIsolated(`${import.meta.dir}/fixtures/emitted-action-registry.ts`, {
        args: [mode, nativeRoutes],
        inheritEnv: false,
        envFile: false,
        bunfig: `${import.meta.dir}/fixtures/emitted-action-registry.toml`,
        timeoutMs: 30_000,
      })
      assertIsolatedOk(result, `native Action registry ${mode} passed`)
    }, 35_000)
  }
}
