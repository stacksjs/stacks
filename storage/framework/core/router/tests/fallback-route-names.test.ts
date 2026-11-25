import { expect, test } from 'bun:test'
import { runIsolated } from '@stacksjs/testing'

test('framework fallback names preserve application routes', async () => {
  const result = await runIsolated(`${import.meta.dir}/fixtures/fallback-route-names.ts`, {
    preload: [],
    envFile: false,
    // The email bundle carries the framework's `email.unsubscribe` names.
    env: { STACKS_DEFAULT_ROUTES: 'email' },
  })
  expect(result.timedOut).toBe(false)
  expect(result.code, result.stderr).toBe(0)
  expect(result.stdout).toContain('fallback named routes OK')
}, 65_000)
