import { expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('optional recovery tables recognize native error records without swallowing other failures', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'stacks-recovery-errors-'))
  try {
    const config = join(directory, 'bunfig.toml')
    await writeFile(config, 'preload = []\n')
    const child = Bun.spawn([process.execPath, `--config=${config}`, '--no-env-file', `${import.meta.dir}/fixtures/recovery-error-records.ts`], {
      env: { ...process.env, APP_ENV: 'test', DB_CONNECTION: 'sqlite', DB_DATABASE_PATH: join(directory, 'unused.sqlite') },
      stdout: 'pipe', stderr: 'pipe',
    })
    const watchdog = setTimeout(() => child.kill(), 10_000)
    try {
      const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
      expect(code, `${stdout}\n${stderr}`).toBe(0)
      expect(stdout).toContain('recovery error records OK')
    }
    finally { clearTimeout(watchdog); child.kill(); await child.exited }
  }
  finally { await rm(directory, { recursive: true, force: true }) }
}, 15_000)
