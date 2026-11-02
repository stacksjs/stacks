import { SQL } from 'bun'
import { test } from 'bun:test'
import { assertIsolatedOk, runIsolated, withDisposableDatabase } from '@stacksjs/testing'
import { disposablePostgresUrl } from '@stacksjs/testing/disposable-database'
for (const dialect of ['sqlite', 'postgres'] as const) {
  test.skipIf(dialect === 'postgres' && !disposablePostgresUrl())(`${dialect} row leases exclude another process and fence expired owners`, async () => {
    await withDisposableDatabase(dialect, async database => {
      assertIsolatedOk(await runIsolated(`${import.meta.dir}/fixtures/row-lease.ts`, { env: { ...database.env, APP_ENV: 'test' }, envFile: false, preload: [] }), 'row leases OK')
    })
  }, 30000)
}

test.skipIf(!disposablePostgresUrl())('postgres row leases admit one simultaneous first claimant at default and serializable isolation', async () => {
  await withDisposableDatabase('postgres', async database => {
    assertIsolatedOk(await runIsolated(`${import.meta.dir}/fixtures/row-lease-contention.ts`, {
      env: { ...database.env, APP_ENV: 'test' }, envFile: false, preload: [], timeoutMs: 30000,
    }), 'simultaneous row leases OK')
  })
}, 35000)

for (const fixture of ['row-lease', 'row-lease-contention']) {
  test.skipIf(!process.env.STACKS_TEST_MYSQL_URL)(`mysql ${fixture} preserves lease ownership across processes`, async () => {
    const endpoint = new URL(process.env.STACKS_TEST_MYSQL_URL!)
    if (!['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname)) throw new Error('Lease tests require an owned local MySQL server')
    const name = `stacks_test_leases_${crypto.randomUUID().replaceAll('-', '')}`
    const admin = new SQL(endpoint.href)
    let created = false
    try {
      await admin.unsafe(`CREATE DATABASE \`${name}\``)
      created = true
      assertIsolatedOk(await runIsolated(`${import.meta.dir}/fixtures/${fixture}.ts`, {
        env: { APP_ENV: 'test', DB_CONNECTION: 'mysql', DB_DATABASE_PATH: ':memory:', DB_DATABASE: name,
          DB_HOST: endpoint.hostname, DB_PORT: endpoint.port || '3306', DB_USERNAME: decodeURIComponent(endpoint.username), DB_PASSWORD: decodeURIComponent(endpoint.password),
          DB_SSL: String(['true', '1'].includes(endpoint.searchParams.get('ssl') ?? '')) },
        envFile: false, preload: [], timeoutMs: 30000,
      }), fixture === 'row-lease' ? 'row leases OK' : 'simultaneous row leases OK')
    }
    finally {
      try { if (created) await admin.unsafe(`DROP DATABASE \`${name}\``) }
      finally { await admin.close() }
    }
  }, 35000)
}
