import { expect, test } from 'bun:test'
import { SQL } from 'bun'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * A running process's `selectAll()` has to survive another process adding a
 * column (stacksjs/stacks#2975). That is Bun.SQL's prepared-statement cache,
 * fixed in Bun 1.4.4, so this pins the runtime Stacks requires rather than
 * any code of its own.
 */
const connection = process.env.STACKS_TEST_POSTGRES_URL
test.skipIf(!connection)('postgres selectAll keeps working after another process adds a column', async () => {
  const url = new URL(connection!)
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
    throw new Error('Cached-plan tests require a local disposable database server')
  const directory = await mkdtemp(join(tmpdir(), 'stacks-cached-plan-'))
  const name = `stacks_cached_plan_${crypto.randomUUID().replaceAll('-', '')}`
  const admin = new SQL(url.href)
  let created = false
  try {
    const config = join(directory, 'bunfig.toml')
    await writeFile(config, 'preload = []\n')
    await admin.unsafe(`CREATE DATABASE "${name}"`)
    created = true
    const child = Bun.spawn([process.execPath, `--config=${config}`, '--no-env-file', `${import.meta.dir}/fixtures/postgres-cached-plan.ts`], {
      env: {
        ...process.env, APP_ENV: 'test', DB_CONNECTION: 'postgres', DB_QUERY_LOGGING_ENABLED: 'false', DB_DATABASE_PATH: ':memory:',
        DB_DATABASE: name, DB_HOST: url.hostname, DB_PORT: url.port || '5432',
        DB_USERNAME: decodeURIComponent(url.username), DB_PASSWORD: decodeURIComponent(url.password),
        DB_SSL: url.searchParams.get('ssl') === 'true' ? 'true' : 'false',
      },
      stdout: 'pipe', stderr: 'pipe', signal: AbortSignal.timeout(25_000),
    })
    const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    expect(code, `${stdout}\n${stderr}`).toBe(0)
    expect(stdout).toContain('cached plan OK')
  }
  finally {
    try { if (created) await admin.unsafe(`DROP DATABASE "${name}" WITH (FORCE)`) }
    finally {
      try { await admin.close() }
      finally { await rm(directory, { recursive: true, force: true }) }
    }
  }
}, 30_000)
