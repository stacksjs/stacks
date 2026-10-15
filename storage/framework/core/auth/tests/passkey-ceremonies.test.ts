import { expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('discoverable passkeys register, authenticate once, expire, and cannot remove the last factor', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'stacks-passkey-login-'))
  try {
    const config = join(directory, 'bunfig.toml')
    const database = join(directory, 'auth.sqlite')
    await writeFile(config, 'preload = []\n')
    const child = Bun.spawn([
      process.execPath,
      `--config=${config}`,
      '--no-env-file',
      `${import.meta.dir}/fixtures/passkey-ceremonies.ts`,
    ], {
      env: {
        ...process.env,
        APP_ENV: 'test',
        APP_URL: 'https://app.example',
        DB_CONNECTION: 'sqlite',
        DB_DATABASE_PATH: database,
      },
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const watchdog = setTimeout(() => child.kill(), 20_000)
    try {
      const [code, stdout, stderr] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ])
      expect(code, `${stdout}\n${stderr}`).toBe(0)
      expect(stdout).toContain('passkey ceremonies OK')
    }
    finally {
      clearTimeout(watchdog)
      child.kill()
    }
  }
  finally {
    await rm(directory, { recursive: true, force: true })
  }
}, 25_000)
