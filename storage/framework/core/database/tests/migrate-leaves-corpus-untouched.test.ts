import { expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { SQL } from 'bun'

/**
 * `buddy migrate` never writes the committed migration files (stacksjs/stacks#2929).
 *
 * One migrate against a Postgres development database rewrote a SQLite app's
 * hand-written migrations into `ADD COLUMN IF NOT EXISTS`, which SQLite cannot
 * parse, and SQLite preprocessing rewrote and deleted committed files the same
 * way. See the fixture.
 */
async function run(env: Record<string, string>, root: string): Promise<void> {
  await writeFile(join(root, 'bunfig.toml'), 'preload = []\n')
  const child = Bun.spawn([process.execPath, `--config=${join(root, 'bunfig.toml')}`, '--no-env-file', join(import.meta.dir, 'fixtures/migrate-leaves-corpus-untouched.ts')], {
    cwd: root,
    env: { ...process.env, APP_ENV: 'test', ...env },
    stdout: 'pipe',
    stderr: 'pipe',
    signal: AbortSignal.timeout(50_000),
  })
  const [code, out, err] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
  expect(code, out + err).toBe(0)
  expect(out).toContain(`committed corpus untouched by ${env.DB_CONNECTION} migrate`)
}

test('sqlite: migrate applies the corpus without rewriting it', async () => {
  const root = await mkdtemp(join(tmpdir(), 'stacks-corpus-untouched-sqlite-'))
  try {
    await run({ DB_CONNECTION: 'sqlite', DB_DATABASE_PATH: join(root, 'app.sqlite') }, root)
  }
  finally { await rm(root, { recursive: true, force: true }) }
}, 60_000)

test.skipIf(!process.env.STACKS_TEST_POSTGRES_URL)('postgres: migrate applies a SQLite-authored corpus without rewriting it', async () => {
  const url = new URL(process.env.STACKS_TEST_POSTGRES_URL!)
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
    throw new Error('Requires a local disposable PostgreSQL server')
  const database = `stacks_corpus_untouched_${crypto.randomUUID().replaceAll('-', '')}`
  const admin = new SQL(url.href, { database: decodeURIComponent(url.pathname.slice(1)) })
  const root = await mkdtemp(join(tmpdir(), 'stacks-corpus-untouched-postgres-'))
  let created = false
  try {
    await admin.unsafe(`CREATE DATABASE "${database}"`)
    created = true
    await run({ DB_CONNECTION: 'postgres', DB_DATABASE: database, PGDATABASE: database, DB_HOST: url.hostname, DB_PORT: url.port || '5432', DB_USERNAME: decodeURIComponent(url.username), DB_PASSWORD: decodeURIComponent(url.password) }, root)
  }
  finally {
    if (created)
      await admin.unsafe(`DROP DATABASE "${database}" WITH (FORCE)`)
    await admin.close()
    await rm(root, { recursive: true, force: true })
  }
}, 60_000)
