import { test } from 'bun:test'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { disposablePostgresUrl, withDisposableDatabase } from '@stacksjs/testing/disposable-database'
import { assertIsolatedOk, runIsolated } from '@stacksjs/testing/isolated'

for (const dialect of ['sqlite', 'postgres'] as const) {
  test.skipIf(dialect === 'postgres' && !disposablePostgresUrl())(`${dialect}: database workers reserve idle polling for an empty runnable queue`, async () => {
    await withDisposableDatabase(dialect, async database => {
      await mkdir(join(database.directory, 'app/Jobs'), { recursive: true })
      await writeFile(join(database.directory, 'app/Jobs/QuickJob.ts'), `export default { name: 'QuickJob', tries: 1, handle(payload) { globalThis.recordQuickJob(payload.index) } }`)
      assertIsolatedOk(await runIsolated(`${import.meta.dir}/fixtures/worker-idle-polling.ts`, {
        cwd: database.directory, env: { ...database.env, APP_ENV: 'test', QUEUE_DRIVER: 'database' }, envFile: false, preload: [], timeoutMs: 25000,
      }), 'worker idle polling OK')
    })
  }, 35000)
}
