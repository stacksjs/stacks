import { expect, test } from 'bun:test'
import { SQL } from 'bun'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

for (const dialect of ['sqlite', 'postgres'] as const) {
  const connection = process.env.STACKS_PREFERENCE_TEST_POSTGRES_URL
  test.skipIf(dialect === 'postgres' && !connection)(`${dialect} notification preferences and inbox preserve writes and opt-outs`, async () => {
    const directory = mkdtempSync(join(tmpdir(), 'stacks-preferences-regressions-'))
    const url = dialect === 'postgres' ? new URL(connection!) : null
    if (url && !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new Error('Workflow tests require a local disposable PostgreSQL server')
    const name = `stacks_preferences_${crypto.randomUUID().replaceAll('-', '')}`
    const admin = url ? new SQL(url.href) : null
    const config = join(directory, 'bunfig.toml')
    const preload = join(directory, 'preload.ts')
    writeFileSync(preload, 'export {}\n')
    writeFileSync(config, `preload = [${JSON.stringify(preload)}]\n`)
    let created = false
    try {
      if (admin) { await admin.unsafe(`CREATE DATABASE "${name}"`); created = true }
      const child = Bun.spawn([process.execPath, `--config=${config}`, '--no-env-file', join(import.meta.dir, 'fixtures/preferences-runtime.ts')], {
        env: { ...process.env, APP_ENV: 'test', DB_CONNECTION: dialect, DB_DATABASE_PATH: join(directory, 'test.sqlite'), STACKS_PREFERENCE_TEST_DIRECTORY: directory,
          STRIPE_SECRET_KEY: '', STRIPE_WEBHOOK_SECRET: '', KISI_API_KEY: '', NOTIFICATION_DELIVERY_MODE: 'log',
          ...(url ? { DB_DATABASE: name, DB_HOST: url.hostname, DB_PORT: url.port || '5432', DB_USERNAME: decodeURIComponent(url.username), DB_PASSWORD: decodeURIComponent(url.password) } : {}) },
        stdout: 'pipe', stderr: 'pipe',
      })
      const watchdog = setTimeout(() => child.kill(), 45_000)
      try {
        const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
        expect(code, `${stdout}\n${stderr}`).toBe(0)
        expect(stdout).toContain('preference runtime OK')
      }
      finally { clearTimeout(watchdog); child.kill() }
    }
    finally {
      try { if (created) await admin!.unsafe(`DROP DATABASE "${name}" WITH (FORCE)`) }
      finally { await admin?.close(); rmSync(directory, { recursive: true, force: true }) }
    }
  }, 50_000)
}
