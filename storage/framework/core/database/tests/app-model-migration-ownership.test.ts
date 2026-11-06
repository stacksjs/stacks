import { expect, test } from 'bun:test'
import { runIsolated } from '@stacksjs/testing'

test('disabled dashboard preserves migrations for inherited app models', async () => {
  const result = await runIsolated(`${import.meta.dir}/fixtures/app-model-migration-ownership.ts`, {
    preload: [],
    envFile: false,
    timeoutMs: 60_000,
  })
  expect(result.timedOut).toBe(false)
  expect(result.code, result.stderr).toBe(0)
  expect(result.stdout).toContain('app model migration ownership OK')
}, 65_000)
