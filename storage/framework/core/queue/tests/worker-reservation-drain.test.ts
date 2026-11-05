import { test } from 'bun:test'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { disposablePostgresUrl, withDisposableDatabase } from '@stacksjs/testing/disposable-database'
import { assertIsolatedOk, runIsolated } from '@stacksjs/testing/isolated'

for (const dialect of ['sqlite', 'postgres'] as const) {
  for (const boundary of ['selection', 'reservation'] as const) {
    test.skipIf(dialect === 'postgres' && !disposablePostgresUrl())(`${dialect}: shutdown drains the database ${boundary} boundary`, async () => {
      await withDisposableDatabase(dialect, async database => {
        await mkdir(join(database.directory, 'app/Jobs'), { recursive: true })
        await writeFile(join(database.directory, 'app/Jobs/DrainJob.ts'), `export default { name: 'DrainJob', tries: 1, handle() { globalThis.recordDrainedJob() } }`)
        assertIsolatedOk(await runIsolated(`${import.meta.dir}/fixtures/worker-reservation-drain.ts`, {
          cwd: database.directory, env: { ...database.env, APP_ENV: 'test', QUEUE_DRIVER: 'database', DRAIN_BOUNDARY: boundary }, envFile: false, preload: [], timeoutMs: 15000,
        }), 'worker reservation drain OK')
      })
    }, 25000)
  }
}
