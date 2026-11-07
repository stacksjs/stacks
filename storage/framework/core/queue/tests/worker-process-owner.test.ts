import { test } from 'bun:test'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { withDisposableDatabase } from '@stacksjs/testing/disposable-database'
import { assertIsolatedOk, runIsolated } from '@stacksjs/testing/isolated'

test.skipIf(process.platform !== 'linux')('a restarted worker reclaims only a positively dead local reservation before its TTL', async () => {
  await withDisposableDatabase('sqlite', async database => {
    await mkdir(join(database.directory, 'app/Jobs'), { recursive: true })
    await writeFile(join(database.directory, 'app/Jobs/RecoveredJob.ts'), `export default { name: 'RecoveredJob', tries: 3, handle() { globalThis.recoveredJob() } }`)
    const result = await runIsolated(`${import.meta.dir}/fixtures/worker-process-owner.ts`, {
      cwd: database.directory, env: { ...database.env, APP_ENV: 'test', QUEUE_DRIVER: 'database', STACKS_QUEUE_RESERVATION_TTL_SEC: '10800' },
      envFile: false, preload: [], timeoutMs: 15000,
    })
    assertIsolatedOk(result, 'dead owner recovered; live, foreign and legacy reservations preserved')
  })
}, 25000)
