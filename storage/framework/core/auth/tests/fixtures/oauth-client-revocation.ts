/**
 * A revoked OAuth client's tokens stop authenticating, through every lookup
 * the auth middleware uses. For oauth-client-revocation.test.ts.
 */
import assert from 'node:assert/strict'

const database = process.env.STACKS_OAUTH_REVOCATION_FIXTURE_DB
assert(database, 'Only run with an isolated fixture database')

const { overridesReady } = await import('@stacksjs/config')
const { db, ensureDatabaseConfigLoaded, initializeDbConfig } = await import('@stacksjs/database')
await overridesReady
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: { default: 'sqlite', connections: { sqlite: { database } }, queryLogging: { enabled: false } } })

const { configureOrm } = await import('bun-query-builder')
configureOrm({ database })
const { ormReady } = await import('@stacksjs/orm')
await ormReady

const { Auth, createClient, createToken, findToken, revokeClient } = await import('../../src')
const { ensureFrameworkAuthTables } = await import('../helpers/auth-schema')

await db.unsafe(`CREATE TABLE users (
  id INTEGER PRIMARY KEY, name TEXT, email TEXT NOT NULL, password TEXT NOT NULL,
  password_changed_at TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP
)`).execute()
await db.insertInto('users').values({ id: 1, name: 'Ada', email: 'ada@example.test', password: 'x' }).execute()
await ensureFrameworkAuthTables()

const results: Record<string, unknown> = {}
const check = async (label: string, bearer: string) => {
  results[label] = {
    getUserFromToken: Boolean(await Auth.getUserFromToken(bearer)),
    validateToken: await Auth.validateToken(bearer),
    findToken: Boolean(await findToken(bearer)),
  }
}

const thirdParty = await createClient({ name: 'Third party', redirect: 'https://third.example.test/cb', passwordClient: true })
const other = await createClient({ name: 'Other', redirect: 'https://other.example.test/cb', passwordClient: true })
const revokedLater = (await createToken(1, 'third-party', ['*'], { clientId: thirdParty.client.id })).plainTextToken
const unaffected = (await createToken(1, 'other', ['*'], { clientId: other.client.id })).plainTextToken

await check('before', revokedLater)
await revokeClient(thirdParty.client.id)
await check('afterRevokeClient', revokedLater)
await check('otherClient', unaffected)

// A delegated token whose grant is revoked, while its client stays active.
const delegated = (await createToken(1, 'delegated', ['issues:read'], { clientId: other.client.id })).plainTextToken
await db.unsafe(`INSERT INTO oauth_grants (id, client_id, subject_type, subject_id, scopes, resources, audiences, revoked_at)
  VALUES ('g1', ${other.client.id}, 'users', 1, '["issues:read"]', '[]', '[]', CURRENT_TIMESTAMP)`).execute()
await db.unsafe(`UPDATE oauth_access_tokens SET oauth_grant_id = 'g1', resources = '[]', audiences = '[]' WHERE name = 'delegated'`).execute()
await check('revokedGrant', delegated)

const tokenRows = await db.unsafe(`SELECT revoked FROM oauth_access_tokens WHERE oauth_client_id = ${thirdParty.client.id}`).execute() as Array<{ revoked: number }>
results.thirdPartyRowsRevoked = tokenRows.every(row => Number(row.revoked) === 1)

console.log(JSON.stringify(results))
process.exit(0)
