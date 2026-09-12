import { expect, test } from 'bun:test'
import { SQL } from 'bun'

async function checkCompletion(dialect: 'sqlite' | 'mysql' | 'postgres', connection?: string): Promise<void> {
  const url = connection ? new URL(connection) : undefined
  if (url && !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
    throw new Error('Transaction completion fixtures require a local disposable database server')
  const name = `stacks_completion_${crypto.randomUUID().replaceAll('-', '')}`
  const admin = url ? new SQL(url.href) : undefined
  const quoted = dialect === 'mysql' ? `\`${name}\`` : `"${name}"`
  let created = false
  try {
    if (admin) {
      await admin.unsafe(`CREATE DATABASE ${quoted}`)
      created = true
    }
    const child = Bun.spawn([process.execPath, `${import.meta.dir}/fixtures/transaction-completion-boundary.ts`], {
      env: {
        ...process.env, APP_ENV: 'test', DB_CONNECTION: dialect, DB_DATABASE_PATH: ':memory:',
        ...(url ? {
          DB_DATABASE: name, DB_HOST: url.hostname, DB_PORT: url.port || (dialect === 'mysql' ? '3306' : '5432'),
          DB_USERNAME: decodeURIComponent(url.username), DB_PASSWORD: decodeURIComponent(url.password),
          DB_SSL: url.searchParams.get('ssl') === 'true' ? 'true' : 'false',
        } : {}),
      },
      stdout: 'pipe', stderr: 'pipe',
    })
    const watchdog = setTimeout(() => child.kill(), 25000)
    try {
      const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
      expect(code, `${stdout}\n${stderr}`).toBe(0)
      expect(stdout).toContain('transaction completion boundary OK')
    }
    finally {
      clearTimeout(watchdog)
      child.kill()
    }
  }
  finally {
    try {
      if (created)
        await admin!.unsafe(`DROP DATABASE ${quoted}${dialect === 'postgres' ? ' WITH (FORCE)' : ''}`)
    }
    finally { await admin?.close() }
  }
}

test('SQLite transaction observer errors preserve committed effects', () => checkCompletion('sqlite'), 30000)
test.skipIf(!process.env.STACKS_TEST_MYSQL_URL)('MySQL transaction observer errors preserve committed effects', () => checkCompletion('mysql', process.env.STACKS_TEST_MYSQL_URL), 30000)
test.skipIf(!process.env.STACKS_TEST_POSTGRES_URL)('Postgres transaction observer errors preserve committed effects', () => checkCompletion('postgres', process.env.STACKS_TEST_POSTGRES_URL), 30000)
