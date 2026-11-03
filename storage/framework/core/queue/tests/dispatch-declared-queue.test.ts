import { test } from 'bun:test'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { disposablePostgresUrl, withDisposableDatabase } from '@stacksjs/testing/disposable-database'
import { assertIsolatedOk, runIsolated } from '@stacksjs/testing/isolated'

for (const dialect of ['sqlite', 'postgres'] as const) {
  test.skipIf(dialect === 'postgres' && !disposablePostgresUrl())(`${dialect}: by-name jobs inherit their declared queue unless explicitly overridden`, async () => {
    await withDisposableDatabase(dialect, async database => {
      await mkdir(join(database.directory, 'app/Jobs'), { recursive: true })
      await writeFile(join(database.directory, 'app/Jobs/RoutedJob.ts'), `export default { name: 'Routed', queue: 'notifications', handle() { throw Error('dispatch must not execute a queued handler') } }`)
      await writeFile(join(database.directory, 'app/Jobs/PlainJob.ts'), `export default { name: 'Plain', handle() { throw Error('dispatch must not execute a queued handler') } }`)
      assertIsolatedOk(await runIsolated(`${import.meta.dir}/fixtures/dispatch-declared-queue.ts`, {
        cwd: database.directory, env: { ...database.env, APP_ENV: 'test', QUEUE_DRIVER: 'database' }, envFile: false, preload: [], timeoutMs: 15000,
      }), 'declared queue dispatch OK')
    })
  }, 25000)
}
