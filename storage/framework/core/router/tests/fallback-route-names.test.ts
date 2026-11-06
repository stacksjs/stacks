import { expect, test } from 'bun:test'
import { runIsolated } from '@stacksjs/testing'

test('framework fallback names preserve application routes', async () => {
  const result = await runIsolated(`${import.meta.dir}/fixtures/fallback-route-names.ts`, {
    preload: [],
    envFile: false,
    env: { STACKS_DEFAULT_ROUTES: 'dashboard' },
  })
  expect(result.timedOut).toBe(false)
  expect(result.code, result.stderr).toBe(0)
  expect(result.stdout).toContain('fallback named routes OK')
}, 65_000)
