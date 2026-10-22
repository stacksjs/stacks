/**
 * A record created through the generated store route of a `useUuid` model gets
 * a uuid, as `Model.create()` gives it one. See ./fixtures/auto-crud-uuid.ts.
 *
 * Each case gets its own working directory, a project whose `storage/framework`
 * and `config` link to this one, and its own database. The Postgres case
 * skips unless STACKS_TEST_POSTGRES_URL names a local one; CI sets it.
 */

import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { SQL } from 'bun'
import { expect, test } from 'bun:test'

const framework = resolve(import.meta.dir, '../../..')

for (const dialect of ['sqlite', 'postgres'] as const) {
  const connection = dialect === 'postgres' ? process.env.STACKS_TEST_POSTGRES_URL : undefined
  test.skipIf(dialect !== 'sqlite' && !connection)(`${dialect}: the generated store route gives a useUuid record its uuid`, async () => {
    const url = connection ? new URL(connection) : undefined
    if (url && !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
      throw new Error('Auto-CRUD uuid tests require a local disposable database server')
    const project = await mkdtemp(join(tmpdir(), 'stacks-auto-crud-uuid-'))
    const name = `stacks_auto_crud_uuid_${crypto.randomUUID().replaceAll('-', '')}`
    const admin = url ? new SQL(url.href) : undefined
    let created = false
    try {
      await mkdir(join(project, 'storage'))
      await symlink(framework, join(project, 'storage', 'framework'))
      await symlink(resolve(framework, '../../config'), join(project, 'config'))
      const config = join(project, 'bunfig.toml')
      await writeFile(config, 'preload = []\n')
      if (admin) { await admin.unsafe(`CREATE DATABASE "${name}"`); created = true }
      const child = Bun.spawn([process.execPath, `--config=${config}`, '--no-env-file', join(import.meta.dir, 'fixtures', 'auto-crud-uuid.ts')], {
        cwd: project,
        env: {
          // A framework model under test, so its API is selected explicitly (#2954).
          ...process.env, STACKS_MODEL_APIS: 'all', APP_ENV: 'test', DB_CONNECTION: dialect, DB_QUERY_LOGGING_ENABLED: 'false',
          DB_DATABASE_PATH: dialect === 'sqlite' ? join(project, 'routes.sqlite') : ':memory:',
          ...(url
            ? {
                DB_DATABASE: name, DB_HOST: url.hostname, DB_PORT: url.port || '5432',
                DB_USERNAME: decodeURIComponent(url.username), DB_PASSWORD: decodeURIComponent(url.password),
                DB_SSL: url.searchParams.get('ssl') === 'true' ? 'true' : 'false',
              }
            : {}),
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
        expect(stdout).toContain(`auto-crud uuid OK ${dialect}`)
      }
      finally { clearTimeout(watchdog); child.kill() }
    }
    finally {
      try { if (created) await admin!.unsafe(`DROP DATABASE "${name}" WITH (FORCE)`) }
      finally {
        try { await admin?.close() }
        finally { await rm(project, { recursive: true, force: true }) }
      }
    }
  }, 30_000)
}
