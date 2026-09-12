import { expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// The migration module captures its database settings at import time. These
// fixtures change cwd for each database, so use a fresh process with a relative
// path rather than inheriting the shell's absolute application database path.
test('SQLite preprocessor uses only its isolated fixture databases', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'stacks-preprocess-test-'))
  const child = Bun.spawn([process.execPath, 'test', `${import.meta.dir}/fixtures/preprocess-sqlite.fixture.ts`], {
    cwd: directory,
    env: {
      ...process.env, APP_ENV: 'test', DB_CONNECTION: 'sqlite',
      DB_DATABASE_PATH: 'database/stacks.sqlite', DB_MIGRATIONS_PATH: 'database/migrations',
    },
    stdout: 'pipe', stderr: 'pipe',
  })
  const watchdog = setTimeout(() => child.kill(), 15_000)
  try {
    const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    expect(code, `${stdout}\n${stderr}`).toBe(0)
  }
  finally {
    clearTimeout(watchdog)
    child.kill()
    await rm(directory, { recursive: true, force: true })
  }
}, 20_000)
