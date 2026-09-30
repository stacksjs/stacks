import { expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('OAuth delegated codes and refresh families survive process restart', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'stacks-oauth-restart-'))
  const database = join(directory, 'oauth.sqlite')
  const config = join(directory, 'bunfig.toml')
  await writeFile(config, 'preload = []\n')

  const run = async (phase: string, extra: Record<string, string> = {}) => {
    const child = Bun.spawn([process.execPath, `--config=${config}`, '--no-env-file', `${import.meta.dir}/fixtures/oauth-restart-persistence.ts`], {
      env: {
        ...process.env,
        APP_ENV: 'test',
        DB_CONNECTION: 'sqlite',
        DB_DATABASE_PATH: database,
        STACKS_OAUTH_RESTART_CONFIG: config,
        STACKS_OAUTH_RESTART_PHASE: phase,
        ...extra,
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
      return stdout
    }
    finally {
      clearTimeout(watchdog)
      child.kill()
    }
  }

  try {
    const seed = await run('seed')
    const seedValues = JSON.parse(seed.match(/^SEED (.+)$/m)?.[1] ?? '') as { clientId: number, code: string }
    const exchange = await run('exchange', {
      STACKS_OAUTH_RESTART_CLIENT_ID: String(seedValues.clientId),
      STACKS_OAUTH_RESTART_CODE: seedValues.code,
    })
    const exchanged = JSON.parse(exchange.match(/^EXCHANGED (.+)$/m)?.[1] ?? '') as {
      accessToken: string
      refreshToken: string
    }
    const verified = await run('verify', {
      STACKS_OAUTH_RESTART_CLIENT_ID: String(seedValues.clientId),
      STACKS_OAUTH_RESTART_ACCESS_TOKEN: exchanged.accessToken,
      STACKS_OAUTH_RESTART_REFRESH_TOKEN: exchanged.refreshToken,
    })
    expect(verified).toContain('PASS OAuth restart persistence')
  }
  finally {
    await rm(directory, { recursive: true, force: true })
  }
}, 90_000)
