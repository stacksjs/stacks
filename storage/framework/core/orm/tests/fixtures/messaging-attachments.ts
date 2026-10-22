/**
 * Messaging attachments against a database that predates them, per dialect.
 *
 * `chat_messages.attachments` was added after messaging shipped, so most
 * databases that have the table do not have the column until migrate runs
 * the column guarantee. Two claims depend on the dialect and were only ever
 * exercised on SQLite: that a text-only send still works before the column
 * exists, and that the guarantee adds it on Postgres and MySQL (#2931).
 *
 * Two phases in two processes, as a deploy runs them: the app sending on the
 * old schema, then migrate and the app it restarts. One process across the
 * migration fails on Postgres for a reason that is not messaging's, filed as
 * its own issue: a connection that prepared `SELECT *` before a column was
 * added refuses to run it again ("cached plan must not change result type").
 */
import assert from 'node:assert/strict'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
if (dialect !== 'sqlite') {
  assert(process.env.DB_DATABASE?.startsWith('stacks_messaging_attachments_'))
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(process.env.DB_HOST!))
}
const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, messagingTableSql, migrateTraitTables, resetDatabaseConnection, sqlHelpers } = await import('@stacksjs/database')
await ensureDatabaseConfigLoaded()
const connection = dialect === 'sqlite' ? { database: process.env.DB_DATABASE_PATH } : {
  name: process.env.DB_DATABASE, host: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD,
}
initializeDbConfig({ app: { env: 'test' }, database: { default: dialect, connections: { [dialect]: connection }, queryLogging: { enabled: false } } } as any)
const { createMessenger } = await import('../../src/messaging')

async function hasAttachmentsColumn(): Promise<boolean> {
  const rows = dialect === 'sqlite'
    ? await db.unsafe(`SELECT name AS column_name FROM pragma_table_info('chat_messages')`)
    : await db.unsafe(`SELECT column_name FROM information_schema.columns WHERE table_name = 'chat_messages'${dialect === 'mysql' ? ' AND table_schema = DATABASE()' : ''}`)
  return (rows as unknown as Array<Record<string, string>>).some(row => (row.column_name ?? row.COLUMN_NAME) === 'attachments')
}

const phase = process.env.STACKS_MESSAGING_PHASE
assert(phase === 'legacy' || phase === 'migrated')
const options = { scope: 'gym:1', authorize: () => true, broadcast: false }
const coach = createMessenger({ ...options, actorId: 1 })
const athlete = createMessenger({ ...options, actorId: 2 })

try {
  if (phase === 'legacy') {
    // The schema as it shipped before attachments.
    for (const statement of messagingTableSql(sqlHelpers(dialect))) await db.unsafe(statement)
    await db.unsafe('ALTER TABLE chat_messages DROP COLUMN attachments')
    assert.equal(await hasAttachmentsColumn(), false, 'the legacy table must lack the column')
    // An application that never attaches keeps sending before migrate runs.
    const { id } = await coach.direct(2)
    assert.deepEqual((await coach.send(id, 'Before the column', 'legacy')).attachments, [])
    console.log('messaging legacy OK')
  }
  else {
    const migrated = await migrateTraitTables()
    assert.equal(migrated.success, true, migrated.error)
    assert.equal(await hasAttachmentsColumn(), true, 'migrate must add the column')

    const { id } = await coach.direct(2)
    const photo = [{ file: 'a1b2c3d4.jpeg', type: 'image/jpeg', size: 2048, width: 100, height: 200 }]
    const sent = await coach.send(id, '', 'photo', photo)
    assert.equal(sent.body, '')
    assert.deepEqual(sent.attachments, photo)
    const history = (await athlete.messages(id)).messages
    assert.deepEqual(history.map(message => message.attachments), [[], photo], 'the legacy row reads as none, the photo out of the column')
    assert.equal((await coach.send(id, '', 'photo', photo)).id, sent.id, 'a retry is the same message')
    await assert.rejects(coach.send(id, '', 'photo', [{ file: 'other.jpeg' }]), (error: any) => error.status === 409)

    // A second migrate changes nothing and keeps what was written.
    assert.equal((await migrateTraitTables()).success, true)
    assert.deepEqual((await athlete.messages(id)).messages.at(-1)?.attachments, photo)
    console.log('messaging attachments OK')
  }
}
finally { resetDatabaseConnection() }
