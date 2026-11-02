import assert from 'node:assert/strict'
import { keysetPage } from '../../src/keyset-pagination'
const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection } = await import('@stacksjs/database')
await ensureDatabaseConfigLoaded()
const dialect = process.env.DB_CONNECTION === 'postgres' ? 'postgres' : 'sqlite'
initializeDbConfig({ app: { env: 'test' }, database: { default: dialect, connections: {
  sqlite: { database: process.env.DB_DATABASE_PATH },
  postgres: { name: process.env.DB_DATABASE!, host: process.env.DB_HOST!, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME!, password: process.env.DB_PASSWORD! },
}, queryLogging: { enabled: false } } })
try {
  await db.unsafe('CREATE TABLE conversations (id INTEGER PRIMARY KEY, owner_id INTEGER, updated_at TIMESTAMP NULL)').execute()
  for (let id = 1; id <= 17; id++) await db.insertInto('conversations').values({ id, owner_id: id === 17 ? 2 : 1, updated_at: id < 10 ? '2026-11-02T09:00:00.123Z' : id < 15 ? '2026-11-01T09:00:00.456Z' : null }).execute()
  const order = [{ column: 'conversations.updated_at', key: 'updated_at', direction: 'desc' }, { column: 'conversations.id', key: 'id', direction: 'desc' }] as const
  const pages: number[][] = []
  let cursor: string | null = null
  do {
    const page = await keysetPage(db.selectFrom('conversations').selectAll().where('owner_id', '=', 1), { order, perPage: 3, cursor, scope: 'owner:1' })
    pages.push(page.data.map(row => Number(row.id)))
    cursor = page.next_cursor
    assert.equal(page.has_more, cursor !== null)
  } while (cursor)
  assert.deepEqual(pages.flat(), [9, 8, 7, 6, 5, 4, 3, 2, 1, 14, 13, 12, 11, 10, 16, 15])
  const first = await keysetPage(db.selectFrom('conversations').selectAll().where('owner_id', '=', 1), { order, perPage: 2, scope: 'owner:1' })
  await assert.rejects(() => keysetPage(db.selectFrom('conversations').selectAll(), { order, perPage: 2, cursor: first.next_cursor, scope: 'owner:2' }), /Invalid pagination cursor/)
  for (const bad of ['!', 'e30', 'W10', 12]) await assert.rejects(() => keysetPage(db.selectFrom('conversations').selectAll(), { order, perPage: 2, cursor: bad, scope: 'owner:1' }), /Invalid pagination cursor/)
  await assert.rejects(() => keysetPage(db.selectFrom('conversations').selectAll(), { order: [{ column: 'id;drop table conversations' }], perPage: 2, scope: 'owner:1' }), /Invalid keyset ordering/)
  const ascending = await keysetPage(db.selectFrom('conversations').selectAll().where('owner_id', '=', 1), { order: [{ column: 'id', direction: 'asc' }], perPage: 4, scope: 'asc' })
  assert.deepEqual(ascending.data.map(row => Number(row.id)), [1, 2, 3, 4])
  await db.unsafe('CREATE TABLE items (id INTEGER PRIMARY KEY, conversation_id INTEGER)').execute()
  for (let id = 1; id <= 5; id++) await db.insertInto('items').values({ id, conversation_id: 1 }).execute()
  let joinedCursor: string | null = null
  const joined: number[] = []
  do {
    const page = await keysetPage(db.selectFrom('conversations').innerJoin('items', 'items.conversation_id', '=', 'conversations.id').select(['conversations.id', 'items.id as item_id']), {
      order: [{ column: 'conversations.id', key: 'id' }, { column: 'items.id', key: 'item_id' }], perPage: 2, cursor: joinedCursor, scope: 'joined',
    })
    joined.push(...page.data.map(row => Number(row.item_id)))
    joinedCursor = page.next_cursor
  } while (joinedCursor)
  assert.deepEqual(joined, [5, 4, 3, 2, 1])
  console.log('keyset pages OK')
}
finally { await resetDatabaseConnection() }
