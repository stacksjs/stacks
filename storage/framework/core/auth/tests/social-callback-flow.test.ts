import { expect, it } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * The default social routes end to end (login CSRF, no tokens in URLs, the
 * unverified-local-email guard): see fixtures/social-callback-flow.ts. Run in
 * a child process because it rewrites config.services and stubs fetch.
 */
it('the default social sign-in flow is browser-bound, single use and keeps tokens out of URLs', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'stacks-social-callback-'))
  try {
    const config = join(directory, 'bunfig.toml')
    await writeFile(config, 'preload = []\n')
    const child = Bun.spawn([process.execPath, `--config=${config}`, '--no-env-file', `${import.meta.dir}/fixtures/social-callback-flow.ts`], {
      env: { ...process.env, APP_ENV: 'test', MAIL_MAILER: 'log', DB_CONNECTION: 'sqlite', DB_DATABASE_PATH: join(directory, 'auth.sqlite'), DB_QUERY_LOGGING_ENABLED: 'false' },
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const watchdog = setTimeout(() => child.kill(), 40_000)
    try {
      const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
      expect(code, `${stdout}\n${stderr}`).toBe(0)
      expect(stdout).toContain('social callback flow OK')
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
