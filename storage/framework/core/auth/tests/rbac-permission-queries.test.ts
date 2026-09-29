import { expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('RBAC resolves direct and inherited permissions in one cold read', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'stacks-rbac-permissions-'))
  try {
    const database = join(directory, 'rbac.sqlite')
    const config = join(directory, 'bunfig.toml')
    await writeFile(config, 'preload = []\n')
    const child = Bun.spawn([process.execPath, `--config=${config}`, '--no-env-file', `${import.meta.dir}/fixtures/rbac-permission-queries.ts`], {
      env: { ...process.env, APP_ENV: 'test', DB_CONNECTION: 'sqlite', DB_DATABASE_PATH: database, STACKS_RBAC_PERMISSIONS_DB: database },
      stdout: 'pipe', stderr: 'pipe',
    })
    const watchdog = setTimeout(() => child.kill(), 20_000)
    try {
      const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
      expect(code, `${stdout}\n${stderr}`).toBe(0)
      expect(stdout).toContain('RBAC permission query count OK')
    }
    finally { clearTimeout(watchdog); child.kill() }
  }
  finally { await rm(directory, { recursive: true, force: true }) }
}, 25_000)
