import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SqliteCacheStore } from '../src/drivers/sqlite'

const directories: string[] = []
const stores: SqliteCacheStore[] = []
function pair(prefix = 'TenantA', otherPrefix = 'tenanta'): [SqliteCacheStore, SqliteCacheStore] {
  const directory = mkdtempSync(join(tmpdir(), 'stacks-cache-isolation-'))
  directories.push(directory)
  const options = { path: join(directory, 'cache.sqlite') }
  const a = new SqliteCacheStore({ ...options, prefix })
  const b = new SqliteCacheStore({ ...options, prefix: otherPrefix })
  stores.push(a, b)
  return [a, b]
}
afterEach(async () => {
  for (const store of stores.splice(0)) await store.close()
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

describe('SQLite cache namespace isolation', () => {
  test('statistics count only live keys in this namespace', async () => {
    const [a, b] = pair('one', 'two')
    await a.set('own', 1)
    await b.set('other', 2)
    expect((await a.getStats()).keys).toBe(1)
    expect((await b.getStats()).keys).toBe(1)
  })

  test('case-distinct namespaces cannot list or delete each other', async () => {
    const [a, b] = pair()
    await a.set('one', 1)
    await b.set('two', 2)
    expect(await a.keys()).toEqual(['one'])
    await a.flush()
    expect(await b.get('two')).toBe(2)
  })
})
