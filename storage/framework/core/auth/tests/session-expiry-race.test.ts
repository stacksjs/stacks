import { expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('expired session cleanup preserves a concurrent renewal', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'stacks-session-expiry-race-'))
  try {
    const database = join(directory, 'sessions.sqlite')
    const config = join(directory, 'bunfig.toml')
    await writeFile(config, 'preload = []\n')
    const child = Bun.spawn([process.execPath, `--config=${config}`, '--no-env-file', `${import.meta.dir}/fixtures/session-expiry-race.ts`], {
      env: { ...process.env, APP_ENV: 'test', DB_CONNECTION: 'sqlite', DB_DATABASE_PATH: database, STACKS_SESSION_EXPIRY_RACE_DB: database },
      stdout: 'pipe', stderr: 'pipe',
    })
    const watchdog = setTimeout(() => child.kill(), 25_000)
    try {
      const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
      expect(code, `${stdout}\n${stderr}`).toBe(0)
      expect(stdout).toContain('session expiry cleanup races OK')
    }
    finally {
      clearTimeout(watchdog)
      child.kill()
    }
  }
  finally {
    await rm(directory, { recursive: true, force: true })
  }
}, 30_000)
