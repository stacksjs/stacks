import { expect, test } from 'bun:test'
import { SQL } from 'bun'

test.skipIf(!process.env.STACKS_TEST_POSTGRES_URL)('PostgreSQL rollback, retries and connection recovery preserve transaction scope', async () => {
  const url = new URL(process.env.STACKS_TEST_POSTGRES_URL!)
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
    throw new Error('Transaction integration tests require a local PostgreSQL test server')
  const name = `stacks_transaction_test_${crypto.randomUUID().replaceAll('-', '')}`
  const admin = new SQL(url.href)
  let created = false
  try {
    await admin.unsafe(`CREATE DATABASE "${name}"`)
    created = true
    const child = Bun.spawn([process.execPath, `${import.meta.dir}/fixtures/postgres-transaction-scope.ts`], {
      env: {
        ...process.env,
        APP_ENV: 'test', DB_CONNECTION: 'postgres', DB_DATABASE_PATH: ':memory:',
        DB_HOST: url.hostname, DB_PORT: url.port || '5432', DB_DATABASE: name,
        DB_USERNAME: decodeURIComponent(url.username), DB_PASSWORD: decodeURIComponent(url.password),
      },
      stdout: 'pipe', stderr: 'pipe',
    })
    const watchdog = setTimeout(() => child.kill(), 25_000)
    try {
      const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
      expect(code, `${stdout}\n${stderr}`).toBe(0)
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
    }
  }
}, 60_000)
