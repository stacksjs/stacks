import assert from 'node:assert/strict'
import { releaseOrm } from 'bun-query-builder'

const database = process.env.DB_DATABASE_PATH
assert(database)

const {
  closeDatabaseConnection,
  db,
  ensureDatabaseConfigLoaded,
  initializeDbConfig,
  sqlDateTime,
} = await import('@stacksjs/database/runtime')
await ensureDatabaseConfigLoaded()
initializeDbConfig({
  app: { env: 'test' },
  database: {
    default: 'sqlite',
    connections: { sqlite: { database } },
    queryLogging: { enabled: false },
  },
})

const { configureOrm } = await import('bun-query-builder')
configureOrm({ database })
const { ormReady } = await import('@stacksjs/orm')
await ormReady
const { resolveSocialSignIn, SocialSignInRefusedError } = await import('../../src/socials')

try {
  await db.unsafe('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email VARCHAR(255) UNIQUE, password TEXT, created_at TIMESTAMP, updated_at TIMESTAMP)').execute()
  await db.unsafe(`
    CREATE TABLE social_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL,
      provider_user_id TEXT NOT NULL,
      provider_email TEXT,
      user_id INTEGER,
      created_at TIMESTAMP,
      updated_at TIMESTAMP
    )
  `).execute()
  await db.insertInto('users').values({
    id: 7,
    name: 'Legacy User',
    email: 'Legacy@Example.com',
    password: 'unused',
    created_at: sqlDateTime(),
  }).execute()

  await assert.rejects(
    resolveSocialSignIn('github', {
      id: 'unverified-provider-7',
      name: 'Legacy User',
      email: 'legacy@example.com',
      emailVerified: false,
    }),
    (error: unknown) => error instanceof SocialSignInRefusedError && error.reason === 'unverified-provider-email',
  )
  assert.equal((await db.selectFrom('users').select('id').execute()).length, 1)
  assert.equal((await db.selectFrom('social_accounts').select('id').execute()).length, 0)

  const result = await resolveSocialSignIn('github', {
    id: 'provider-7',
    name: 'Legacy User',
    email: 'legacy@example.com',
    emailVerified: true,
  })

  assert.deepEqual(result, { userId: 7, createdUser: false, linked: true })
  assert.equal((await db.selectFrom('users').select('id').execute()).length, 1)
  const link = await db.selectFrom('social_accounts').selectAll().executeTakeFirstOrThrow()
  assert.equal(Number(link.user_id), 7)
  assert.equal(link.provider_email, 'legacy@example.com')
  console.log('social legacy email linking OK')
}
finally {
  releaseOrm()
  await closeDatabaseConnection()
}
