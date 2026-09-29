import assert from 'node:assert/strict'
import { basename, dirname } from 'node:path'

const file = process.env.STACKS_TOKEN_PROJECTION_DB
assert(file && basename(dirname(file)).startsWith('stacks-token-projection-'))
assert.equal(process.env.DB_CONNECTION, 'sqlite')
assert.equal(process.env.DB_DATABASE_PATH, file)

const { config, overridesReady } = await import('@stacksjs/config')
await overridesReady
if (config.database.queryLogging) config.database.queryLogging.enabled = false
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, closeDatabaseConnection } = await import('@stacksjs/database/runtime')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: {
  default: 'sqlite', connections: { sqlite: { database: file } }, queryLogging: { enabled: false },
} })

const { configureOrm, releaseOrm } = await import('bun-query-builder')
configureOrm({ database: file })
const { ormReady } = await import('@stacksjs/orm')
await ormReady
const { ensureFrameworkAuthTables } = await import('../helpers/auth-schema')
const { createToken, currentAccessToken, findToken } = await import('../../src/tokens')
const { Auth } = await import('../../src/authentication')
const { enhanceRequest } = await import('@stacksjs/router')
const { runWithRequest } = await import('../../../router/src/request-context')
const { registerPersistentQueryHooks } = await import('@stacksjs/query-builder')

try {
  await db.unsafe('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email TEXT, password TEXT, created_at TIMESTAMP, updated_at TIMESTAMP)').execute()
  await db.insertInto('users').values({ id: 1, name: 'Projection fixture', email: 'projection@example.invalid', password: 'unused' }).execute()
  await ensureFrameworkAuthTables()

  const pair = await createToken(1, 'projection', ['posts:read'], { withRefreshToken: false })
  const tokenReads: string[] = []
  const unregister = registerPersistentQueryHooks({
    onQueryStart(event) {
      if (/\bfrom\s+["`]?oauth_access_tokens["`]?\b/i.test(event.sql))
        tokenReads.push(event.sql)
    },
  })

  try {
    assert.equal(await Auth.validateToken(pair.plainTextToken), true)
    assert(await Auth.getUserFromToken(pair.plainTextToken))
    await runWithRequest(enhanceRequest(new Request('https://projection.invalid/account', {
      headers: { authorization: `Bearer ${pair.plainTextToken}` },
    })), async () => {
      assert(await Auth.currentAccessToken())
    })
    assert(await findToken(pair.plainTextToken))
    await runWithRequest(enhanceRequest(new Request('https://projection.invalid/account', {
      headers: { authorization: `Bearer ${pair.plainTextToken}` },
    })), async () => {
      assert(await currentAccessToken())
    })
    assert.equal((await Auth.tokens(1)).length, 1)
    assert(await Auth.findToken(pair.accessToken.id))
  }
  finally { unregister() }

  assert.equal(tokenReads.length, 5)
  for (const sql of tokenReads)
    assert(!/\bselect\s+(?:\w+\.)?\*/i.test(sql), `token lookup must not transfer every column: ${sql}`)

  console.log('token projection OK')
}
finally {
  await releaseOrm()
  await closeDatabaseConnection()
}
