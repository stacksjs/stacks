import { expect, test } from 'bun:test'
import { SQL } from 'bun'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

async function checkLifecycle(database: { dialect: 'sqlite' | 'postgres' | 'mysql', url?: URL }): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), 'stacks-session-http-'))
  const file = database.url?.href ?? join(directory, 'sessions.sqlite')
  const cookiesFile = join(directory, 'cookies.json')
  try {
    for (const phase of ['login', 'logout']) {
      const child = Bun.spawn([process.execPath, `${import.meta.dir}/fixtures/session-http-lifecycle.ts`, phase, cookiesFile], {
        env: {
          ...process.env,
          APP_ENV: 'test',
          DB_CONNECTION: database.dialect,
          DB_DATABASE_PATH: database.dialect === 'sqlite' ? file : ':memory:',
          ...(database.url ? {
            DB_HOST: database.url.hostname,
            DB_PORT: database.url.port,
            DB_DATABASE: database.url.pathname.slice(1),
            DB_USERNAME: decodeURIComponent(database.url.username),
            DB_PASSWORD: decodeURIComponent(database.url.password),
            ...(database.dialect === 'mysql' ? { DB_SSL: database.url.searchParams.get('ssl') === 'true' ? 'true' : 'false' } : {}),
          } : {}),
          STACKS_SESSION_FIXTURE_DB: file,
        },
        stdout: 'pipe',
        stderr: 'pipe',
      })
      const watchdog = setTimeout(() => child.kill(), 25_000)
      try {
        const [code, stdout, stderr] = await Promise.all([
          child.exited,
          new Response(child.stdout).text(),
          new Response(child.stderr).text(),
        ])
        expect(code, `${phase}: ${stdout}\n${stderr}`).toBe(0)
      }
      finally {
        clearTimeout(watchdog)
        child.kill()
      }
    }
  }
  finally {
    await rm(directory, { recursive: true, force: true })
  }
}

test('SQLite sessions survive restart and cannot authenticate after HTTP logout', () => checkLifecycle({ dialect: 'sqlite' }), 60_000)

// Opt in with a local test server whose role can CREATE DATABASE.
// Only the uniquely named database created here is ever modified or dropped.
async function checkServerLifecycle(dialect: 'postgres' | 'mysql', connection: string): Promise<void> {
  const url = new URL(connection)
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
    throw new Error('Session integration tests require a local database test server')
  const name = `stacks_session_test_${crypto.randomUUID().replaceAll('-', '')}`
  const quoted = dialect === 'postgres' ? `"${name}"` : `\`${name}\``
  const admin = new SQL(url.href)
  let created = false
  try {
    await admin.unsafe(`CREATE DATABASE ${quoted}`)
    created = true
    url.pathname = `/${name}`
    await checkLifecycle({ dialect, url })
  }
  finally {
    try {
      if (created)
        await admin.unsafe(`DROP DATABASE ${quoted}${dialect === 'postgres' ? ' WITH (FORCE)' : ''}`)
    }
    finally {
      await admin.close()
    }
  }
}

test.skipIf(!process.env.STACKS_TEST_POSTGRES_URL)('PostgreSQL sessions survive restart and cannot authenticate after HTTP logout', () => checkServerLifecycle('postgres', process.env.STACKS_TEST_POSTGRES_URL!), 60_000)

test.skipIf(!process.env.STACKS_TEST_MYSQL_URL)('MySQL sessions survive restart and cannot authenticate after HTTP logout', () => checkServerLifecycle('mysql', process.env.STACKS_TEST_MYSQL_URL!), 60_000)
