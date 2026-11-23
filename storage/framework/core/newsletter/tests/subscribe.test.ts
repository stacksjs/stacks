import { expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('subscribe() validates, honours public lists, and reactivates opt-outs', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'stacks-newsletter-subscribe-'))
  try {
    const preload = join(directory, 'preload.ts')
    const config = join(directory, 'bunfig.toml')
    writeFileSync(preload, 'export {}\n')
    writeFileSync(config, `preload = [${JSON.stringify(preload)}]\n`)
    const child = Bun.spawn([process.execPath, `--config=${config}`, '--no-env-file', join(import.meta.dir, 'fixtures/subscribe.ts')], {
      env: { ...process.env, APP_ENV: 'test', DB_CONNECTION: 'sqlite', DB_QUERY_LOGGING_ENABLED: 'false', DB_DATABASE_PATH: join(directory, 'test.sqlite') },
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const watchdog = setTimeout(() => child.kill(), 25_000)
    try {
      const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
      expect(code, `${stdout}\n${stderr}`).toBe(0)
      expect(stdout).toContain('newsletter subscribe OK')
    }
    finally { clearTimeout(watchdog); child.kill() }
  }
  finally { rmSync(directory, { recursive: true, force: true }) }
}, 30_000)
