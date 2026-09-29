import { expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('OAuth delegated lifecycle and replay containment work through real HTTP routes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'stacks-oauth-http-'))
  const database = join(directory, 'oauth.sqlite')
  try {
    const child = Bun.spawn([process.execPath, `${import.meta.dir}/fixtures/oauth-http-lifecycle.ts`], {
      env: {
        ...process.env,
        APP_ENV: 'test',
        DB_CONNECTION: 'sqlite',
        DB_DATABASE_PATH: database,
        STACKS_OAUTH_HTTP_FIXTURE_DB: database,
      },
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const watchdog = setTimeout(() => child.kill(), 30_000)
    try {
      const [code, stdout, stderr] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ])
      expect(code, `${stdout}\n${stderr}`).toBe(0)
      expect(stdout).toContain('PASS OAuth HTTP lifecycle')
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
