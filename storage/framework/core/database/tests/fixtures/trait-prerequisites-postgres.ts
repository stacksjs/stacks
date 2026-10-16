import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { SQL } from 'bun'

const { DB_DATABASE: name, DB_HOST: host, DB_PORT: port, DB_USERNAME: username, DB_PASSWORD: password } = process.env
assert(name?.startsWith('stacks_trait_prerequisites_'))
assert(host && ['127.0.0.1', 'localhost', '[::1]'].includes(host))
const root = process.cwd()
const corpus = join(root, 'database/migrations')
mkdirSync(corpus, { recursive: true })
writeFileSync(join(corpus, '0000000001-create-commentables.sql'), '-- qb:generated\nCREATE TABLE commentables (id BIGSERIAL PRIMARY KEY, custom_column TEXT);')
writeFileSync(join(corpus, '0000000002-create-preferences.sql'), `-- qb:generated
CREATE TABLE preferences (id BIGSERIAL PRIMARY KEY,
  conversation_id VARCHAR(64) REFERENCES chat_conversations(id) ON DELETE CASCADE,
  message_id BIGINT REFERENCES chat_messages(id) ON DELETE CASCADE,
  comment_id BIGINT REFERENCES commentables(id));`)
const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection } = await import('../../src/utils')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: { default: 'postgres', connections: { postgres: { name, host, port: Number(port), username, password } }, queryLogging: { enabled: false } } } as any)
const { runDatabaseMigration } = await import('../../src/migrations')
const probe = new SQL({ adapter: 'postgres', hostname: host, port: Number(port), database: name, username, password, max: 1 })
try {
  const first = await runDatabaseMigration()
  assert(first.isOk, first.isErr ? first.error.message : '')
  await probe`INSERT INTO chat_conversations VALUES ('thread', 'scope', 'users', 1, 2, now())`
  await probe`INSERT INTO preferences (conversation_id) VALUES ('thread')`
  await assert.rejects(probe`INSERT INTO preferences (conversation_id) VALUES ('missing')`)
  const again = await runDatabaseMigration()
  assert(again.isOk, again.isErr ? again.error.message : '')
  assert.equal((await probe`SELECT COUNT(*)::int AS count FROM preferences`)[0].count, 1)
  const columns = await probe`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='commentables'`
  assert(columns.some(row => row.column_name === 'custom_column'))
  assert(!columns.some(row => row.column_name === 'title'))
  await probe`DELETE FROM chat_conversations WHERE id='thread'`
  assert.equal((await probe`SELECT COUNT(*)::int AS count FROM preferences`)[0].count, 0)
  console.log('native trait prerequisites OK')
}
finally { await probe.close(); resetDatabaseConnection() }
