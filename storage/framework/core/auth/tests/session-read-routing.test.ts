import { SQL } from 'bun'
import { expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test.skipIf(!process.env.STACKS_TEST_POSTGRES_URL)('session and token authentication read committed primary state despite replica lag', async () => {
  const url = new URL(process.env.STACKS_TEST_POSTGRES_URL!)
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
    throw new Error('Session routing tests require a local disposable PostgreSQL server')
  const directory = await mkdtemp(join(tmpdir(), 'stacks-session-routing-'))
  const name = `stacks_session_routing_${crypto.randomUUID().replaceAll('-', '')}`
  const password = crypto.randomUUID()
  const admin = new SQL({ url: url.href, max: 1 })
  let databaseCreated = false
  let roleCreated = false
  try {
    await admin.unsafe(`CREATE DATABASE "${name}"`)
    databaseCreated = true
    await admin.unsafe(`CREATE ROLE "${name}" LOGIN PASSWORD '${password}'`)
    roleCreated = true
    // A second schema holds a lagged snapshot; only the replica connection's
    // role sees it. Both connections use a real PostgreSQL query executor.
    await admin.unsafe(`ALTER ROLE "${name}" IN DATABASE "${name}" SET search_path TO lagged`)
    const config = join(directory, 'bunfig.toml')
    await writeFile(config, 'preload = []\n')
    const child = Bun.spawn([process.execPath, `--config=${config}`, '--no-env-file', `${import.meta.dir}/fixtures/session-read-routing.ts`], {
      env: {
        ...process.env, APP_ENV: 'test', DB_CONNECTION: 'postgres', DB_DATABASE_PATH: ':memory:',
        DB_HOST: url.hostname, DB_PORT: url.port || '5432', DB_DATABASE: name,
        DB_USERNAME: decodeURIComponent(url.username), DB_PASSWORD: decodeURIComponent(url.password),
        STACKS_SESSION_REPLICA_USER: name, STACKS_SESSION_REPLICA_PASSWORD: password,
      }, stdout: 'pipe', stderr: 'pipe',
    })
    const watchdog = setTimeout(() => child.kill(), 25_000)
    try {
      const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
      expect(code, `${stdout}\n${stderr}`).toBe(0)
      expect(stdout).toContain('session and token primary reads OK')
    }
    finally { clearTimeout(watchdog); child.kill() }
  }
  finally {
    try {
      if (databaseCreated) await admin.unsafe(`DROP DATABASE "${name}" WITH (FORCE)`)
      if (roleCreated) await admin.unsafe(`DROP ROLE "${name}"`)
    }
    finally { await admin.close(); await rm(directory, { recursive: true, force: true }) }
  }
}, 30_000)
