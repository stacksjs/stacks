import { test } from 'bun:test'
import { assertIsolatedOk, runIsolated } from '../../testing/src/isolated'

for (const mode of ['source', 'dist'] as const) {
  // CI builds native runtime packages before the core suites.
  for (const scenario of ['identity', 'capacity', 'pending', 'close', 'context', 'heartbeat', 'observer-failure', 'defaults'] as const) {
    test(`broadcast observers ${scenario} through ${mode} exports`, async () => {
      const result = await runIsolated(`${import.meta.dir}/fixtures/stream-observers.ts`, {
        args: [mode, scenario],
        inheritEnv: false,
        envFile: false,
        bunfig: `${import.meta.dir}/fixtures/stream-observers.toml`,
        timeoutMs: 10_000,
      })
      assertIsolatedOk(result, `broadcast observer ${scenario} passed`)
    }, 15_000)
  }
}
