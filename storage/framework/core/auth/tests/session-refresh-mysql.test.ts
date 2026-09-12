import { SQL } from 'bun'
import { expect, test } from 'bun:test'

test.skipIf(!process.env.STACKS_TEST_MYSQL_URL)('MySQL session refresh preserves idempotent success', async () => {
  const url = new URL(process.env.STACKS_TEST_MYSQL_URL!)
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
    throw new Error('Session integration tests require a local MySQL test server')
  const name = `stacks_session_test_${crypto.randomUUID().replaceAll('-', '')}`
  const admin = new SQL(url.href)
  let created = false
  try {
    await admin.unsafe(`CREATE DATABASE \`${name}\``)
    created = true
    const child = Bun.spawn([process.execPath, `${import.meta.dir}/fixtures/session-refresh-mysql.ts`], {
      env: {
        ...process.env, APP_ENV: 'test', DB_CONNECTION: 'mysql', DB_DATABASE_PATH: ':memory:',
        DB_HOST: url.hostname, DB_PORT: url.port || '3306', DB_DATABASE: name,
        DB_USERNAME: decodeURIComponent(url.username), DB_PASSWORD: decodeURIComponent(url.password),
      },
      stdout: 'pipe', stderr: 'pipe',
    })
    const watchdog = setTimeout(() => child.kill(), 20_000)
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
        await admin.unsafe(`DROP DATABASE \`${name}\``)
    }
    finally {
      await admin.close()
    }
  }
}, 30_000)
