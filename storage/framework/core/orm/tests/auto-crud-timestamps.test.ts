/**
 * The generated store, update, destroy and bulk-delete routes stamp
 * `created_at` / `updated_at` / `deleted_at` in a form each dialect accepts.
 * MySQL's strict mode rejected the `toISOString()` value they wrote, so every
 * write answered 500 there; SQLite and Postgres must keep what they stored.
 * See ./fixtures/auto-crud-timestamps.ts.
 *
 * Each case gets its own working directory, a project whose `storage/framework`
 * and `config` link to this one, and its own database. The process runs in a zone far from
 * UTC, so a timestamp written as local time would land hours away. The server
 * cases skip unless STACKS_TEST_POSTGRES_URL / STACKS_TEST_MYSQL_URL name a
 * local one; CI sets both.
 */

import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { SQL } from 'bun'
import { expect, test } from 'bun:test'

const framework = resolve(import.meta.dir, '../../..')
const cases = [
  { name: 'sqlite', dialect: 'sqlite' },
  { name: 'postgres', dialect: 'postgres' },
  { name: 'mysql', dialect: 'mysql' },
  // The query builder's live connection is MySQL while DB_CONNECTION says
  // SQLite, as when config/database.ts names a different default.
  { name: 'mysql through the query builder config', dialect: 'mysql', qb: true },
] as const

for (const scenario of cases) {
  const connection = scenario.dialect === 'postgres' ? process.env.STACKS_TEST_POSTGRES_URL : scenario.dialect === 'mysql' ? process.env.STACKS_TEST_MYSQL_URL : undefined
  test.skipIf(scenario.dialect !== 'sqlite' && !connection)(`${scenario.name}: generated write routes store timestamps the dialect accepts`, async () => {
    const url = connection ? new URL(connection) : undefined
    if (url && !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
      throw new Error('Auto-CRUD timestamp tests require a local disposable database server')
    const project = await mkdtemp(join(tmpdir(), 'stacks-auto-crud-timestamps-'))
    const name = `stacks_auto_crud_timestamps_${crypto.randomUUID().replaceAll('-', '')}`
    const admin = url ? new SQL(url.href) : undefined
    const quoted = scenario.dialect === 'mysql' ? `\`${name}\`` : `"${name}"`
    let created = false
    try {
      await mkdir(join(project, 'storage'))
      await symlink(framework, join(project, 'storage', 'framework'))
      await symlink(resolve(framework, '../../config'), join(project, 'config'))
      const config = join(project, 'bunfig.toml')
      await writeFile(config, 'preload = []\n')
      if (admin) { await admin.unsafe(`CREATE DATABASE ${quoted}`); created = true }
      const server = url
        ? {
            DB_DATABASE: name, DB_HOST: url.hostname, DB_PORT: url.port || (scenario.dialect === 'mysql' ? '3306' : '5432'),
            DB_USERNAME: decodeURIComponent(url.username), DB_PASSWORD: decodeURIComponent(url.password),
            DB_SSL: url.searchParams.get('ssl') === 'true' ? 'true' : 'false',
          }
        : {}
      const target = url ? new URL(url.href) : undefined
      if (target)
        target.pathname = `/${name}`
      const child = Bun.spawn([process.execPath, `--config=${config}`, '--no-env-file', join(import.meta.dir, 'fixtures', 'auto-crud-timestamps.ts')], {
        cwd: project,
        env: {
          // A framework model under test, so its API is selected explicitly (#2954).
          ...process.env, STACKS_MODEL_APIS: 'all', APP_ENV: 'test', TZ: 'America/Los_Angeles', DB_QUERY_LOGGING_ENABLED: 'false',
          STACKS_AUTO_CRUD_TIMESTAMPS_DIALECT: scenario.dialect,
          ...('qb' in scenario
            ? { DB_CONNECTION: 'sqlite', DB_DATABASE_PATH: join(project, 'unused.sqlite'), STACKS_AUTO_CRUD_TIMESTAMPS_QB_URL: target!.href }
            : { DB_CONNECTION: scenario.dialect, DB_DATABASE_PATH: scenario.dialect === 'sqlite' ? join(project, 'routes.sqlite') : ':memory:', ...server }),
        },
        stdout: 'pipe',
        stderr: 'pipe',
      })
      let timedOut = false
      const watchdog = setTimeout(() => { timedOut = true; child.kill() }, 25_000)
      try {
        const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
        expect(timedOut, 'the fixture must finish without a watchdog kill').toBe(false)
        expect(code, `${stdout}\n${stderr}`).toBe(0)
        expect(stdout).toContain(`auto-crud timestamps OK ${scenario.dialect}`)
      }
      finally { clearTimeout(watchdog); child.kill() }
    }
    finally {
      try { if (created) await admin!.unsafe(`DROP DATABASE ${quoted}${scenario.dialect === 'postgres' ? ' WITH (FORCE)' : ''}`) }
      finally {
        try { await admin?.close() }
        finally { await rm(project, { recursive: true, force: true }) }
      }
    }
  }, 30_000)
}
