import { expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SQL } from 'bun'

/**
 * A framework column Postgres holds WITH a timezone, end to end
 * (stacksjs/stacks#2902).
 *
 * The framework writes a naive UTC literal and Postgres interprets one written
 * into an aware column in the session timezone, so every value in such a
 * column is shifted by that offset. That is enough to fail token issuance with
 * `Failed to persist the requested access token`, because the read-back check
 * compares the stored expiry against the instant it asked for.
 *
 * The scratch database's TimeZone is pinned away from UTC here rather than in
 * the fixture: `ALTER DATABASE` reaches every new connection, while a `SET`
 * would reach one connection of a pool (the same reason `datetime-columns.ts`
 * does not pin MySQL's session zone).
 *
 * Needs STACKS_TEST_POSTGRES_URL pointing at a local server whose user may
 * create databases. A uniquely named scratch database is created and dropped.
 */
test.skipIf(!process.env.STACKS_TEST_POSTGRES_URL)('an aware column is found, reported, and converted only when asked', async () => {
  const url = new URL(process.env.STACKS_TEST_POSTGRES_URL!)
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
    throw new Error('Aware timestamp tests require a local PostgreSQL test server')

  const name = `stacks_aware_timestamps_${crypto.randomUUID().replaceAll('-', '')}`
  const admin = new SQL(url.href)
  const root = await mkdtemp(join(tmpdir(), 'stacks-aware-timestamps-'))
  let created = false

  try {
    await admin.unsafe(`CREATE DATABASE "${name}"`)
    created = true
    // Non-UTC, so the shift under test is deterministic rather than a property
    // of whichever zone the server happens to default to.
    await admin.unsafe(`ALTER DATABASE "${name}" SET TimeZone TO 'Asia/Manila'`)
    await writeFile(join(root, 'bunfig.toml'), 'preload = []\n')

    const child = Bun.spawn([process.execPath, `--config=${join(root, 'bunfig.toml')}`, '--no-env-file', `${import.meta.dir}/fixtures/aware-timestamp-columns-postgres.ts`], {
      cwd: root,
      env: {
        ...process.env,
        APP_ENV: 'test',
        DB_CONNECTION: 'postgres',
        DB_HOST: url.hostname,
        DB_PORT: url.port || '5432',
        DB_DATABASE: name,
        DB_USERNAME: decodeURIComponent(url.username),
        DB_PASSWORD: decodeURIComponent(url.password),
        STACKS_CONVERT_AWARE_TIMESTAMPS: '',
      },
      stdout: 'pipe',
      stderr: 'pipe',
    })

    const watchdog = setTimeout(() => child.kill(), 50_000)
    try {
      const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
      expect(code, `${stdout}\n${stderr}`).toBe(0)
      expect(stdout).toContain('aware timestamp columns OK')
    }
    finally {
      clearTimeout(watchdog)
      child.kill()
    }
  }
  finally {
    try {
      if (created)
        await admin.unsafe(`DROP DATABASE "${name}" WITH (FORCE)`)
    }
    finally {
      await admin.close()
      await rm(root, { recursive: true, force: true })
    }
  }
}, 60_000)
