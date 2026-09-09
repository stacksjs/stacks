import { expect, test } from 'bun:test'
import { join } from 'node:path'

test('general SQLite statements retain live bindings, schema and connection ownership', async () => {
  const child = Bun.spawn([process.execPath, join(import.meta.dir, 'fixtures/general-sqlite-statement.ts')], {
    cwd: join(import.meta.dir, '..'),
    env: { ...process.env, APP_ENV: 'production', DB_CONNECTION: 'sqlite', DB_QUERY_LOGGING_ENABLED: 'false' },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  expect(exitCode, `${stdout}\n${stderr}`).toBe(0)
  expect(stdout).toContain('general-sqlite-statement-ok')
})
