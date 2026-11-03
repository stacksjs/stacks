import { assertIsolatedOk, runIsolated } from '@stacksjs/testing/isolated'
import { disposablePostgresUrl, withDisposableDatabase } from '@stacksjs/testing/disposable-database'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'bun:test'

for (const outcome of ['success', 'failure', 'partial'] as const) {
  test.skipIf(!disposablePostgresUrl())(`postgres: ${outcome} batch terminal jobs retain context without becoming members`, async () => {
    await withDisposableDatabase('postgres', async (database) => {
      await mkdir(join(database.directory, 'app/Jobs'), { recursive: true })
      await writeFile(join(database.directory, 'app/Jobs/BatchMember.ts'), `import { appendFile } from 'node:fs/promises'
export default { name: 'BatchMember', tries: 1, async handle(payload) { await appendFile(process.env.BATCH_MEMBER_RESULT, JSON.stringify({ member: payload.member }) + '\\n'); if (payload.fail) throw Error('member failed') } }`)
      await writeFile(join(database.directory, 'app/Jobs/BatchTerminal.ts'), `export default { name: 'BatchTerminal', tries: 1, async handle(payload) { await Bun.write(process.env.BATCH_TERMINAL_RESULT, JSON.stringify(payload)) } }`)
      assertIsolatedOk(await runIsolated(`${import.meta.dir}/fixtures/batch-terminal-worker.ts`, {
        cwd: database.directory,
        env: { ...database.env, APP_ENV: 'test', QUEUE_DRIVER: 'database', BATCH_TERMINAL_OUTCOME: outcome, BATCH_TERMINAL_RESULT: join(database.directory, 'terminal.json'), BATCH_MEMBER_RESULT: join(database.directory, 'members.jsonl') },
        envFile: false, preload: [], timeoutMs: 30_000,
      }), 'batch terminal worker OK')
    })
  }, 40_000)
}
