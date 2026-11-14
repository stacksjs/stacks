import { assertIsolatedOk, disposablePostgresUrl, runIsolated, withDisposableDatabase } from '@stacksjs/testing'
import { expect, test } from 'bun:test'
import { keysetPage } from '../src/keyset-pagination'

for (const dialect of ['sqlite', 'postgres'] as const) {
  test.skipIf(dialect === 'postgres' && !disposablePostgresUrl())(`${dialect}: keyset pages keep tied, nullable and joined rows reachable`, () => withDisposableDatabase(dialect, async (database) => {
    assertIsolatedOk(await runIsolated(`${import.meta.dir}/fixtures/keyset-pagination.ts`, {
      env: { ...database.env, APP_ENV: 'test' }, envFile: false, preload: [], timeoutMs: 20_000,
    }), 'keyset pages OK')
  }), 30_000)
}

// The database facade returns values on its synchronous path.
test('keyset pages accept an in-place query result', async () => {
  const query = {
    where() { return query }, orderBy() { return query },
    orderByRaw() { return query }, limit() { return query },
    execute() { return [{ id: 3 }, { id: 2 }, { id: 1 }] },
  }
  const first = await keysetPage(query, { order: [{ column: 'id' }], perPage: 2, scope: 'sync' })
  expect(first.data).toEqual([{ id: 3 }, { id: 2 }])
  expect(first.has_more).toBe(true)
  expect(first.next_cursor).toBeString()
})
