import { test } from 'bun:test'
import { assertIsolatedOk, runIsolated } from '@stacksjs/testing'

test('the rate runner excludes disabled jobs and schedules enabled jobs', async () => {
  assertIsolatedOk(await runIsolated(`${import.meta.dir}/fixtures/disabled-rate.ts`, { envFile: false, preload: [] }), 'disabled rate OK')
})
