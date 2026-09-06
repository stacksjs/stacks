import { expect, test } from 'bun:test'
import { join } from 'node:path'

test('configured SQLite checkpoint thresholds reach both writers and survive reconnects', async () => {
  const child = Bun.spawn([process.execPath, join(import.meta.dir, 'fixtures/sqlite-pragma-overrides.ts')], {
    cwd: join(import.meta.dir, '..'),
    env: { ...process.env, APP_ENV: 'test', DB_CONNECTION: 'sqlite', DB_DATABASE_PATH: ':memory:' },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [code, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  expect(code, stderr).toBe(0)
  const observations = JSON.parse(stdout.trim().split('\n').at(-1)!)
  for (const [name, threshold] of Object.entries({ defaults: 100, configured: 1000, reconnected: 1000, changed: 2000, restored: 100 })) {
    expect(observations[name], name).toEqual({
      builder: [{ wal_autocheckpoint: threshold }],
      model: { wal_autocheckpoint: threshold },
      builderForeignKeys: [{ foreign_keys: 1 }],
      modelForeignKeys: { foreign_keys: 1 },
    })
  }
})
