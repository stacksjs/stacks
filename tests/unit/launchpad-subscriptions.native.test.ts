import { expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('real native Subscriber models preserve Stacks membership when Launchpad is unsubscribed', async () => {
  const root = mkdtempSync(join(tmpdir(), 'launchpad-subscribers-'))
  const preload = join(root, 'preload.ts')
  const config = join(root, 'bunfig.toml')
  writeFileSync(preload, 'export {}\n')
  writeFileSync(config, `preload = [${JSON.stringify(preload)}]\n`)
  const child = Bun.spawn([process.execPath, `--config=${config}`, '--no-env-file', join(import.meta.dir, '../fixtures/launchpad-subscriptions.ts')], {
    env: { ...process.env, APP_ENV: 'test', DB_CONNECTION: 'sqlite', DB_DATABASE_PATH: join(root, 'test.sqlite'), DB_QUERY_LOGGING_ENABLED: 'false' },
    stdout: 'pipe', stderr: 'pipe',
  })
  const watchdog = setTimeout(() => child.kill(), 25000)
  try {
    const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    expect(code, `${stdout}\n${stderr}`).toBe(0)
    expect(stdout).toContain('Native Launchpad subscription and scoped unsubscribe verified')
  }
  finally {
    clearTimeout(watchdog)
    child.kill()
    rmSync(root, { recursive: true, force: true })
  }
}, 30000)
