import { expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SQL } from 'bun'

/**
 * End to end, against a real PostgreSQL: a database whose history was written
 * by hand is regenerated from its models (obsolete type, index-drop and data
 * files replaced, reference data kept and moved after the corpus), its ledger
 * repointed without re-running anything, and its schema aligned - legacy index
 * names renamed (one of them truncated by Postgres at 63 characters), a missing
 * index created, a narrow column widened, a foreign key refused while an orphan
 * row exists and added once it is gone - ending on a migrate with nothing to
 * run and no index built twice.
 *
 * Needs STACKS_TEST_POSTGRES_URL pointing at a local server whose user may
 * create databases. A uniquely named scratch database is created and dropped.
 */
test.skipIf(!process.env.STACKS_TEST_POSTGRES_URL)('a drifted database is regenerated, reconciled and aligned to its models', async () => {
  const url = new URL(process.env.STACKS_TEST_POSTGRES_URL!)
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
    throw new Error('Model-driven migration tests require a local PostgreSQL test server')
  const name = `stacks_model_migrations_${crypto.randomUUID().replaceAll('-', '')}`
  const admin = new SQL(url.href)
  const root = await mkdtemp(join(tmpdir(), 'stacks-model-migrations-'))
  let created = false
  try {
    await admin.unsafe(`CREATE DATABASE "${name}"`)
    created = true
    await writeFile(join(root, 'bunfig.toml'), 'preload = []\n')
    const child = Bun.spawn([process.execPath, `--config=${join(root, 'bunfig.toml')}`, '--no-env-file', `${import.meta.dir}/fixtures/model-driven-migrations-postgres.ts`], {
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
      },
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const watchdog = setTimeout(() => child.kill(), 50_000)
    try {
      const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
      expect(code, `${stdout}\n${stderr}`).toBe(0)
      expect(stdout).toContain('model-driven migrations OK')
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
