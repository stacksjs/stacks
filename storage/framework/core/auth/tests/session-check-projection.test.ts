import { expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('session checks do not load unused payload data', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'stacks-session-projection-'))
  try {
    const database = join(directory, 'sessions.sqlite')
    const config = join(directory, 'bunfig.toml')
    await writeFile(config, 'preload = []\n')
    const child = Bun.spawn([process.execPath, `--config=${config}`, '--no-env-file', `${import.meta.dir}/fixtures/session-check-projection.ts`], {
      env: { ...process.env, APP_ENV: 'test', DB_CONNECTION: 'sqlite', DB_DATABASE_PATH: database, STACKS_SESSION_PROJECTION_DB: database },
      stdout: 'pipe', stderr: 'pipe',
    })
    const watchdog = setTimeout(() => child.kill(), 15_000)
    try {
      const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
      expect(code, `${stdout}\n${stderr}`).toBe(0)
      expect(stdout).toContain('session check projection OK')
    }
    finally { clearTimeout(watchdog); child.kill() }
  }
  finally { await rm(directory, { recursive: true, force: true }) }
}, 20_000)
