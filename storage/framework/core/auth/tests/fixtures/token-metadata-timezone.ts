import assert from 'node:assert/strict'
import { setSystemTime } from 'bun:test'
import { basename, dirname } from 'node:path'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const configPath = process.env.STACKS_TOKEN_METADATA_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-token-metadata-'))
if (dialect === 'sqlite')
  assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_token_metadata_'))
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(process.env.DB_HOST!))
  assert(process.env.DB_PORT && !['5432', '3306'].includes(process.env.DB_PORT))
}
const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, migrateAuthTables, resetDatabaseConnection } = await import('@stacksjs/database')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: {
  default: dialect,
  connections: dialect === 'sqlite' ? { sqlite: { database: process.env.DB_DATABASE_PATH } } : {
    [dialect]: { name: process.env.DB_DATABASE, host: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD },
  }, queryLogging: { enabled: false },
} })
const { createToken, tokens, findToken, refreshToken, createClient, clients, findClient } = await import('../../src/tokens')
const { Auth } = await import('../../src/authentication')
const originalTimezone = process.env.TZ
const failures: string[] = []
function check(name: string, date: Date | null | undefined, expected: string | null) {
  try { assert.equal(date?.toISOString() ?? null, expected, name) }
  catch (error) { failures.push(String(error)) }
}
const issued = '2030-01-02T03:04:05.000Z'
const rotatedAt = '2030-01-02T03:05:05.000Z'
const expires = '2030-01-02T04:04:05.000Z'
try {
  await db.unsafe('CREATE TABLE users (id INTEGER PRIMARY KEY)').execute()
  await db.insertInto('users').values({ id: 42 }).execute()
  assert.equal((await migrateAuthTables()).success, true)
  for (const timezone of ['UTC', 'Pacific/Honolulu', 'Asia/Kathmandu']) {
    process.env.TZ = timezone
    setSystemTime(new Date(issued))
    const pair = await createToken(42, `clock ${timezone}`, ['read'], { expiresAt: new Date(expires) })
    const found = await findToken(pair.plainTextToken)
    const listed = (await tokens(42)).find(row => Number(row.id) === Number(pair.accessToken.id))
    const facade = (await Auth.tokens(42)).find(row => Number(row.id) === Number(pair.accessToken.id))
    for (const [reader, row] of Object.entries({ created: pair.accessToken, found, listed, facade })) {
      assert(row, `${reader} must return the token`)
      check(`${timezone} ${reader} created`, row.createdAt, issued)
      check(`${timezone} ${reader} updated`, row.updatedAt, issued)
      check(`${timezone} ${reader} expiry`, row.expiresAt, expires)
    }

    // Missing last-use metadata must not make an older token appear active now.
    setSystemTime(new Date(rotatedAt))
    await db.updateTable('oauth_access_tokens').set({ updated_at: null, expires_at: null }).where('id', '=', pair.accessToken.id).execute()
    const untouched = await findToken(pair.plainTextToken)
    const oldList = (await tokens(42)).find(row => Number(row.id) === Number(pair.accessToken.id))
    const oldFacade = (await Auth.tokens(42)).find(row => Number(row.id) === Number(pair.accessToken.id))
    const byId = await Auth.findToken(Number(pair.accessToken.id))
    for (const [reader, row] of Object.entries({ untouched, oldList, oldFacade, byId })) {
      assert(row)
      check(`${timezone} ${reader} fallback last use`, row.updatedAt, issued)
      check(`${timezone} ${reader} null expiry`, row.expiresAt, null)
    }
    const rotated = await refreshToken(pair.refreshToken!)
    check(`${timezone} rotation created`, rotated.accessToken.createdAt, rotatedAt)
    check(`${timezone} rotation updated`, rotated.accessToken.updatedAt, rotatedAt)

    const client = await createClient({ userId: 42, name: `metadata ${timezone}`, redirect: 'https://example.invalid/callback' })
    const clientFound = await findClient(client.client.id)
    const clientListed = (await clients(42)).find(row => Number(row.id) === Number(client.client.id))
    for (const [reader, row] of Object.entries({ created: client.client, clientFound, clientListed })) {
      assert(row)
      check(`${timezone} ${reader} client created`, row.createdAt, rotatedAt)
      check(`${timezone} ${reader} client null update`, row.updatedAt, null)
    }
  }
  if (dialect === 'sqlite') {
    const pair = await createToken(42, 'metadata formats', ['read'], { withRefreshToken: false })
    await db.updateTable('oauth_access_tokens').set({
      created_at: '2030-01-02T08:49:05.000+05:45',
      updated_at: '2030-01-01 17:05:05-10:00',
      expires_at: '2030-01-02T09:49:05.000+05:45',
    }).where('id', '=', pair.accessToken.id).execute()
    const offset = (await Auth.tokens(42)).find(row => Number(row.id) === Number(pair.accessToken.id))!
    check('explicit offset created', offset.createdAt, issued)
    check('explicit offset updated', offset.updatedAt, rotatedAt)
    check('explicit offset expiry', offset.expiresAt, expires)

    // SQLite can contain malformed legacy metadata. Do not report it as a
    // current timestamp or mistake a present invalid expiry for non-expiring.
    for (const malformed of ['', 'not-a-date']) {
      await db.updateTable('oauth_access_tokens').set({ created_at: malformed, updated_at: malformed, expires_at: null })
        .where('id', '=', pair.accessToken.id).execute()
      const readers = [
        await findToken(pair.plainTextToken),
        (await tokens(42)).find(row => Number(row.id) === Number(pair.accessToken.id)),
        (await Auth.tokens(42)).find(row => Number(row.id) === Number(pair.accessToken.id)),
        await Auth.findToken(Number(pair.accessToken.id)),
      ]
      for (const row of readers) {
        assert(row)
        assert(Number.isNaN(row.createdAt.getTime()), 'malformed creation must stay invalid')
        assert(Number.isNaN(row.updatedAt.getTime()), 'malformed last-use must stay invalid')
      }
      await db.updateTable('oauth_access_tokens').set({ expires_at: malformed }).where('id', '=', pair.accessToken.id).execute()
      for (const row of [
        (await tokens(42)).find(row => Number(row.id) === Number(pair.accessToken.id)),
        (await Auth.tokens(42)).find(row => Number(row.id) === Number(pair.accessToken.id)),
      ]) {
        assert(row?.expiresAt instanceof Date)
        assert(Number.isNaN(row.expiresAt.getTime()), 'malformed expiry must not become null')
      }
      assert.equal(await findToken(pair.plainTextToken), null, 'invalid expiry cannot authenticate')
    }
  }
  assert.deepEqual(failures, [])
  console.log('token metadata timezone OK')
}
finally {
  if (originalTimezone === undefined) delete process.env.TZ
  else process.env.TZ = originalTimezone
  setSystemTime()
  resetDatabaseConnection()
}
