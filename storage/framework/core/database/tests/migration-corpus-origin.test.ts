import { expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('a MySQL connection does not pin later Postgres generation to the MySQL corpus', async () => {
  const root = mkdtempSync(join(tmpdir(), 'stacks-corpus-origin-'))
  try {
    const config = join(root, 'bunfig.toml')
    writeFileSync(config, 'preload = []\n')
    const child = Bun.spawn([process.execPath, `--config=${config}`, '--no-env-file', `${import.meta.dir}/fixtures/migration-corpus-origin.ts`], {
      cwd: root, env: { ...process.env, APP_ENV: 'test', DB_CONNECTION: 'mysql', DB_MIGRATIONS_PATH: '', DB_SNAPSHOT_PATH: '' }, stdout: 'pipe', stderr: 'pipe',
    })
    const watchdog = setTimeout(() => child.kill(), 80000)
    try {
      const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
      expect(code, `${stdout}\n${stderr}`).toBe(0)
      expect(stdout).toContain('migration corpus origin OK')
    }
    finally { clearTimeout(watchdog); child.kill() }
  }
  finally { rmSync(root, { recursive: true, force: true }) }
}, 90000)
