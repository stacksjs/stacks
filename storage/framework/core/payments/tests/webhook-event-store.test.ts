import { expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// The default dedupe store against a real database: payment_webhook_events,
// scoped apart from commerce's rows, with a memory fallback before migrating.
test('webhook events are remembered in payment_webhook_events', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'stacks-payments-webhook-events-'))
  try {
    const preload = join(directory, 'preload.ts')
    const config = join(directory, 'bunfig.toml')
    writeFileSync(preload, 'export {}\n')
    writeFileSync(config, `preload = [${JSON.stringify(preload)}]\n`)
    const child = Bun.spawn([process.execPath, `--config=${config}`, '--no-env-file', join(import.meta.dir, 'fixtures/webhook-event-store.ts')], {
      env: { ...process.env, APP_ENV: 'test', DB_CONNECTION: 'sqlite', DB_DATABASE_PATH: join(directory, 'test.sqlite') },
      stdout: 'pipe', stderr: 'pipe',
    })
    const watchdog = setTimeout(() => child.kill(), 20_000)
    try {
      const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
      expect(code, `${stdout}\n${stderr}`).toBe(0)
      expect(stdout).toContain('webhook event store OK')
    }
    finally { clearTimeout(watchdog); child.kill() }
  }
  finally { rmSync(directory, { recursive: true, force: true }) }
}, 25_000)
