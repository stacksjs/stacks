import { SQL } from 'bun'
import { test } from 'bun:test'
import { assertIsolatedOk, runIsolated, disposablePostgresUrl, withDisposableDatabase } from '@stacksjs/testing'

for (const dialect of ['sqlite', 'postgres'] as const) {
  for (const scenario of ['scope', 'atomic', 'concurrent', 'decoded-json', 'cross-process', 'nested', 'routes', 'csv']) {
    test.skipIf(dialect === 'postgres' && (!disposablePostgresUrl() || scenario === 'csv'))(`${dialect} form ${scenario} preserves its persisted contract`, async () => {
      await withDisposableDatabase(dialect, async (database) => {
        assertIsolatedOk(await runIsolated(`${import.meta.dir}/fixtures/reliability.ts`, {
          env: { ...database.env, APP_ENV: 'test', FORMS_RELIABILITY_SCENARIO: scenario }, envFile: false, preload: [], timeoutMs: 30_000,
        }), `${scenario} OK`)
      })
    }, 40_000)
  }
}

for (const scenario of ['scope', 'atomic', 'concurrent', 'decoded-json', 'cross-process', 'nested', 'routes']) {
  test.skipIf(!process.env.STACKS_TEST_MYSQL_URL)(`mysql form ${scenario} preserves its persisted contract`, async () => {
    const url = new URL(process.env.STACKS_TEST_MYSQL_URL!)
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Forms tests require a local disposable MySQL server')
    const name = `stacks_test_forms_${crypto.randomUUID().replaceAll('-', '')}`
    const admin = new SQL(url.href)
    let created = false
    try {
      await admin.unsafe(`CREATE DATABASE \`${name}\``)
      created = true
      assertIsolatedOk(await runIsolated(`${import.meta.dir}/fixtures/reliability.ts`, {
        env: { APP_ENV: 'test', DB_CONNECTION: 'mysql', DB_DATABASE_PATH: ':memory:', DB_DATABASE: name,
          DB_HOST: url.hostname, DB_PORT: url.port || '3306', DB_USERNAME: decodeURIComponent(url.username), DB_PASSWORD: decodeURIComponent(url.password),
          FORMS_RELIABILITY_SCENARIO: scenario }, envFile: false, preload: [], timeoutMs: 30_000,
      }), `${scenario} OK`)
    }
    finally {
      try { if (created) await admin.unsafe(`DROP DATABASE \`${name}\``) }
      finally { await admin.close() }
    }
  }, 40_000)
}
