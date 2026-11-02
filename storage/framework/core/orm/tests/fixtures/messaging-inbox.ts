/**
 * An inbox of many threads, per dialect (messaging-inbox.test.ts): each
 * thread's newest message and unread count, only threads the application
 * allows, and the same number of queries for three threads as for twelve.
 */
import assert from 'node:assert/strict'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
if (dialect !== 'sqlite') {
  assert(process.env.DB_DATABASE?.startsWith('stacks_messaging_inbox_'))
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(process.env.DB_HOST!))
}
const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, messagingTableSql, sqlHelpers } = await import('@stacksjs/database')
await ensureDatabaseConfigLoaded()
const connection = dialect === 'sqlite' ? { database: process.env.DB_DATABASE_PATH } : {
  name: process.env.DB_DATABASE, host: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD,
}
initializeDbConfig({ app: { env: 'test' }, database: { default: dialect, connections: { [dialect]: connection }, queryLogging: { enabled: false } } } as any)
for (const statement of messagingTableSql(sqlHelpers(dialect))) await db.unsafe(statement).execute()
const { createMessenger } = await import('../../src/messaging')
const { registerPersistentQueryHooks } = await import('@stacksjs/query-builder')

let queries = 0
registerPersistentQueryHooks({ onQueryEnd: () => { queries++ } })

const COACH = 1
const blocked = new Set([99])
let authorizeCalls = 0
const authorize = async (actorId: number, recipientId: number) => {
  authorizeCalls++
  return !blocked.has(actorId) && !blocked.has(recipientId)
}
const as = (actorId: number) => createMessenger({ scope: 'gym:7', actorId, authorize })
const coach = as(COACH)

async function inbox() {
  const start = queries
  const calls = authorizeCalls
  const list = await coach.list()
  return { list, queries: queries - start, authorized: authorizeCalls - calls }
}

// Three athletes: one unanswered, one who wrote back twice, one read.
async function thread(athleteId: number, exchange: Array<'coach' | 'athlete'>) {
  const { id } = await coach.direct(athleteId)
  const athlete = as(athleteId)
  let last = 0
  for (const [index, who] of exchange.entries())
    last = (await (who === 'coach' ? coach : athlete).send(id, `${who} ${index}`, `${athleteId}-${index}`)).id
  return { id, last, athlete }
}
const quiet = await thread(2, ['coach'])
const busy = await thread(3, ['coach', 'athlete', 'athlete'])
const read = await thread(4, ['athlete', 'coach'])
await coach.markRead(read.id, read.last)

let small = await inbox()
assert.equal(small.list.length, 3)
assert.deepEqual(small.list.map(item => item.recipient_id), [4, 3, 2], 'newest thread first')
const byPerson = new Map(small.list.map(item => [item.recipient_id, item]))
assert.equal(byPerson.get(2)!.unread, 0, 'my own unread message is not unread to me')
assert.equal(byPerson.get(2)!.last_message?.body, 'coach 0')
assert.equal(byPerson.get(3)!.unread, 2)
assert.equal(byPerson.get(3)!.last_message?.id, busy.last)
assert.equal(byPerson.get(3)!.last_message?.body, 'athlete 2')
assert.equal(byPerson.get(4)!.unread, 0, 'read through the last message')
assert.equal(byPerson.get(4)!.last_message?.body, 'coach 1')
assert.equal(small.authorized, 3)
// The athlete's side of a thread counts the coach's messages, and only those.
assert.equal((await busy.athlete.list())[0]?.unread, 1)
assert.equal((await quiet.athlete.list())[0]?.unread, 1)
assert.equal((await read.athlete.list())[0]?.unread, 1)

// A thread with no messages yet, and one the application no longer allows.
await coach.direct(5)
blocked.delete(99)
await thread(99, ['athlete'])
blocked.add(99)

for (let athleteId = 10; athleteId < 17; athleteId++)
  await thread(athleteId, ['athlete'])
const large = await inbox()
assert.equal(large.list.length, 11, 'twelve threads, one not allowed')
assert(!large.list.some(item => item.recipient_id === 99))
assert.equal(large.list.find(item => item.recipient_id === 5)!.last_message, null)
assert.equal(large.list.find(item => item.recipient_id === 5)!.unread, 0)
assert.equal(large.list.find(item => item.recipient_id === 16)!.unread, 1)
assert.equal(large.list.at(-1)!.recipient_id, 5, 'a thread with no messages sorts last')
assert.equal(large.authorized, 12)
assert.equal(large.queries, small.queries, `three threads took ${small.queries} queries, twelve took ${large.queries}`)

console.log('messaging inbox OK')
process.exit(0)
