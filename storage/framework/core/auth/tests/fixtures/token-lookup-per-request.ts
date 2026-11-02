/**
 * The auth middleware and the action behind it both resolve the request's
 * bearer. For token-lookup-per-request.test.ts.
 */
import assert from 'node:assert/strict'

const database = process.env.STACKS_TOKEN_LOOKUP_FIXTURE_DB
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

const { Auth, createToken, revokeToken } = await import('../../src')
const { ensureFrameworkAuthTables } = await import('../helpers/auth-schema')
const { registerPersistentQueryHooks } = await import('@stacksjs/query-builder')
const { runWithRequest } = await import('@stacksjs/router')

await db.unsafe(`CREATE TABLE users (
  id INTEGER PRIMARY KEY, name TEXT, email TEXT NOT NULL, password TEXT NOT NULL,
  password_changed_at TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP
)`).execute()
await db.insertInto('users').values({ id: 1, name: 'Ada', email: 'ada@example.test', password: 'x' }).execute()
await db.insertInto('users').values({ id: 2, name: 'Bo', email: 'bo@example.test', password: 'x' }).execute()
await ensureFrameworkAuthTables()

let tokenQueries = 0
registerPersistentQueryHooks({ onQueryEnd: (event) => { if (/oauth_access_tokens/.test(event.sql)) tokenQueries++ } })

const ada = (await createToken(1, 'ada', ['*'])).plainTextToken
const bo = (await createToken(2, 'bo', ['*'])).plainTextToken
const request = (bearer: string) => new Request('http://app.test/', { headers: { authorization: `Bearer ${bearer}` } }) as any
const userId = (user: any) => user ? Number(user.id) : null

const results: Record<string, unknown> = {}

results.sameRequest = await runWithRequest(request(ada), async () => {
  const start = tokenQueries
  const first = await Auth.getUserFromToken(ada)
  const firstQueries = tokenQueries - start
  const second = await Auth.getUserFromToken(ada)
  const secondQueries = tokenQueries - start - firstQueries
  // Another bearer in the same request is its own lookup and its own user.
  const other = await Auth.getUserFromToken(bo)
  const forged = await Auth.getUserFromToken('not-a-token')
  const again = await Auth.getUserFromToken(ada)
  return { first: userId(first), second: userId(second), firstQueries, secondQueries, other: userId(other), forged: userId(forged), again: userId(again) }
})

// A new request looks the bearer up again: revocation applies at once.
await revokeToken(bo)
results.nextRequest = await runWithRequest(request(bo), async () => userId(await Auth.getUserFromToken(bo)))

// Signing out inside the request forgets the answer it had.
results.afterLogout = await runWithRequest(request(ada), async () => {
  const before = userId(await Auth.getUserFromToken(ada))
  await Auth.logout()
  return { before, after: userId(await Auth.getUserFromToken(ada)) }
})

// Outside a request there is nothing to share.
const fresh = (await createToken(1, 'fresh', ['*'])).plainTextToken
const start = tokenQueries
await Auth.getUserFromToken(fresh)
const once = tokenQueries - start
await Auth.getUserFromToken(fresh)
results.outsideRequest = { once, twice: tokenQueries - start }

console.log(JSON.stringify(results))
process.exit(0)
