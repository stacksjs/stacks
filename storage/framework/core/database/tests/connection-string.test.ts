import { SQL } from 'bun'
import { expect, test } from 'bun:test'
import { getConnectionString } from '../src/driver-config'

for (const dialect of ['postgres', 'mysql', 'singlestore', 'vitess'] as const) {
  test(`${dialect} connection strings preserve reserved components and IPv6 hosts`, () => {
    const credentials = { username: 'user@:/?#%', password: 'pass@:/?#%', name: 'database/?#%', host: '::1', port: 55321 }
    const url = new URL(getConnectionString(dialect, credentials))
    expect(decodeURIComponent(url.username)).toBe(credentials.username)
    expect(decodeURIComponent(url.password)).toBe(credentials.password)
    expect(decodeURIComponent(url.pathname.slice(1))).toBe(credentials.name)
    expect(url.hostname).toBe('[::1]')
    expect(url.port).toBe('55321')
    expect(url.search).toBe('')
    expect(url.hash).toBe('')
  })
}

test('Vitess retains its tablet qualifier as part of the keyspace', () => {
  const url = new URL(getConnectionString('vitess', { name: 'training', tabletType: 'replica' }))
  expect(decodeURIComponent(url.pathname.slice(1))).toBe('training@replica')
  expect(url.port).toBe('15306')
})

for (const dialect of ['postgres', 'mysql'] as const) {
  const endpoint = process.env[`STACKS_TEST_${dialect.toUpperCase()}_URL`]
  test.skipIf(!endpoint)(`${dialect} authenticates using separately configured connection components`, async () => {
    const original = new URL(endpoint!)
    if (!['localhost', '127.0.0.1', '[::1]'].includes(original.hostname)) throw new Error('Connection tests require an owned local database')
    const generated = new URL(getConnectionString(dialect, {
      name: decodeURIComponent(original.pathname.slice(1)), host: original.hostname,
      port: Number(original.port) || (dialect === 'postgres' ? 5432 : 3306),
      username: decodeURIComponent(original.username), password: decodeURIComponent(original.password),
    }))
    // TLS belongs to the endpoint's connection options, independent of its credentials.
    generated.search = original.search
    const connection = new SQL(generated.href)
    try { expect(Number((await connection.unsafe('SELECT 1 AS connected'))[0]?.connected)).toBe(1) }
    finally { await connection.close() }
  })
}
