import { expect, test } from 'bun:test'
import { assertIsolatedOk, runIsolated } from '../../testing/src/isolated'

// stacksjs/stacks#2947. See the fixture.
test('an app action wins over a stale registry entry naming the framework default, and says so', async () => {
  const result = await runIsolated(`${import.meta.dir}/fixtures/stale-action-registry.ts`, {
    inheritEnv: false,
    envFile: false,
    bunfig: `${import.meta.dir}/fixtures/emitted-action-registry.toml`,
    timeoutMs: 30_000,
  })
  assertIsolatedOk(result, 'stale action registry passed')

  // Once, for two requests, naming the command that fixes it.
  const output = `${result.stdout}${result.stderr}`
  const warnings = output.split('\n').filter(line => line.includes('registry maps Actions/Auth/LoginAction'))
  expect(warnings).toHaveLength(1)
  expect(warnings[0]).toContain('generate:auto-imports')
  expect(output).not.toContain('registry maps Actions/Auth/LogoutAction')
}, 35_000)
