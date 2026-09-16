import { expect, test } from 'bun:test'
import { SQL } from 'bun'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// MySQL is left out on purpose. The helper's batch statement does not run there
// at all (double-quoted identifiers, and LIMIT inside an IN subquery), which is
// a separate defect from the count this test covers.
for (const dialect of ['sqlite', 'postgres'] as const) {
  const connection = process.env.STACKS_TEST_POSTGRES_URL
  test.skipIf(dialect !== 'sqlite' && !connection)(`${dialect} backfillInBatches fills every batch`, async () => {
    const url = dialect === 'sqlite' ? undefined : new URL(connection!)
    if (url && !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
      throw new Error('Backfill tests require a local disposable database server')
    const directory = await mkdtemp(join(tmpdir(), 'stacks-backfill-batches-'))
    const name = `stacks_backfill_batches_${crypto.randomUUID().replaceAll('-', '')}`
    const admin = url ? new SQL(url.href) : undefined
    const quoted = `"${name}"`
    let created = false
    try {
      const config = join(directory, 'bunfig.toml')
      await writeFile(config, 'preload = []\n')
      if (admin) { await admin.unsafe(`CREATE DATABASE ${quoted}`); created = true }
      const child = Bun.spawn([process.execPath, `--config=${config}`, '--no-env-file', `${import.meta.dir}/fixtures/backfill-batches.ts`], {
        env: {
          ...process.env, APP_ENV: 'test', DB_CONNECTION: dialect, DB_QUERY_LOGGING_ENABLED: 'false',
          DB_DATABASE_PATH: dialect === 'sqlite' ? join(directory, 'backfill-batches.sqlite') : ':memory:',
          STACKS_BACKFILL_BATCHES_CONFIG: config,
          ...(url ? { DB_DATABASE: name, DB_HOST: url.hostname, DB_PORT: url.port || '5432',
            DB_USERNAME: decodeURIComponent(url.username), DB_PASSWORD: decodeURIComponent(url.password),
            DB_SSL: url.searchParams.get('ssl') === 'true' ? 'true' : 'false' } : {}),
        }, stdout: 'pipe', stderr: 'pipe',
      })
      let timedOut = false
      const watchdog = setTimeout(() => { timedOut = true; child.kill() }, 25_000)
      try {
        const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
        expect(timedOut, 'backfill fixture must finish without a watchdog kill').toBe(false)
        expect(code, `${stdout}\n${stderr}`).toBe(0)
        expect(stdout).toContain('backfill batches OK')
      }
      finally { clearTimeout(watchdog); child.kill() }
    }
    finally {
      try { if (created) await admin!.unsafe(`DROP DATABASE ${quoted} WITH (FORCE)`) }
      finally {
        try { await admin?.close() }
        finally { await rm(directory, { recursive: true, force: true }) }
      }
    }
  }, 30_000)
}
