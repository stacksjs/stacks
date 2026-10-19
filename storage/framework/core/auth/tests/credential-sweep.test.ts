import { expect, it } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * revokeAccountCredentials, changePassword, revokeOtherTokens and the reset
 * delivery options over real SQLite: see fixtures/credential-sweep.ts.
 */
it('one credential sweep backs password changes, resets and revokeOtherTokens', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'stacks-credential-sweep-'))
  try {
    const config = join(directory, 'bunfig.toml')
    await writeFile(config, 'preload = []\n')
    const child = Bun.spawn([process.execPath, `--config=${config}`, '--no-env-file', `${import.meta.dir}/fixtures/credential-sweep.ts`], {
      env: { ...process.env, APP_ENV: 'test', MAIL_MAILER: 'log', DB_CONNECTION: 'sqlite', DB_DATABASE_PATH: join(directory, 'auth.sqlite'), DB_QUERY_LOGGING_ENABLED: 'false' },
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const watchdog = setTimeout(() => child.kill(), 40_000)
    try {
      const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
      expect(code, `${stdout}\n${stderr}`).toBe(0)
      expect(stdout).toContain('credential sweep OK')
    }
    finally {
      clearTimeout(watchdog)
      child.kill()
    }
  }
  finally {
    await rm(directory, { recursive: true, force: true })
  }
}, 45_000)
