import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
const file = join(mkdtempSync(join(tmpdir(), 'stacks-messaging-')), 'test.sqlite')
process.env.DB_CONNECTION = 'sqlite'
process.env.DB_DATABASE_PATH = file
const { db, acquireDbConfigLock, ensureDatabaseConfigLoaded, initializeDbConfig, messagingTableSql, sqlHelpers } = await import('@stacksjs/database')
const { createMessenger, MessagingError } = await import('../src/messaging')
const { defineModel } = await import('../src/define-model')
const { configureOrm } = await import('bun-query-builder')
const { createBroadcastHub, getServer, stopServer } = await import('@stacksjs/realtime')
let unlock: () => void
let allowed = true
const options = { scope: 'gym:1', authorize: (a: number, b: number) => allowed && [1, 2].includes(a) && [1, 2].includes(b), pageSize: 2 }
const coach = createMessenger({ ...options, actorId: 1 })
const athlete = createMessenger({ ...options, actorId: 2 })
let id: string
let last: number
beforeAll(async () => {
  unlock = await acquireDbConfigLock()
  await ensureDatabaseConfigLoaded()
  initializeDbConfig({ database: { default: 'sqlite', connections: { sqlite: { database: file }, mysql: {}, postgres: {} } } })
  configureOrm({ database: file })
  for (const statement of messagingTableSql(sqlHelpers('sqlite'))) await db.unsafe(statement).execute()
  await db.unsafe('CREATE TABLE people (id INTEGER PRIMARY KEY, name TEXT)').execute()
  await db.unsafe("INSERT INTO people VALUES (1, 'Coach')").execute()
})
afterAll(async () => { unlock?.(); await stopServer() })
describe('persistent direct messaging', () => {
  it('runs notification integration only for new committed messages', async () => {
    const delivered: number[] = []
    const messenger = createMessenger({ ...options, actorId: 1, onMessageSent: ({ message }) => { delivered.push(message.id) } })
    const thread = await messenger.direct(2)
    await expect(db.transaction(async () => {
      await messenger.send(thread.id, 'Rolled back', 'rollback-notification')
      throw new Error('rollback')
    })).rejects.toThrow('rollback')
    expect(delivered).toEqual([])
    const saved = await messenger.send(thread.id, 'Committed', 'committed-notification')
    await messenger.send(thread.id, 'Committed', 'committed-notification')
    expect(delivered).toEqual([saved.id])
    await db.deleteFrom('chat_messages').where('id', '=', saved.id).execute()
  })

  it('broadcasts private invalidations after persistence and suppresses duplicate retries', async () => {
    createBroadcastHub()
    const events: Array<{ channel: string, event: string, data: unknown }> = []
    const remove = getServer()!.addBroadcastHook(event => { events.push(event) })
    const thread = await coach.direct(2)
    const saved = await coach.send(thread.id, 'Live question', 'live')
    await coach.send(thread.id, 'Live question', 'live')
    expect(events).toHaveLength(2)
    expect(new Set(events.map(e => e.channel)).size).toBe(2)
    expect(events.every(e => e.event === 'messaging.sent' && !JSON.stringify(e.data).includes('Live question'))).toBe(true)
    await athlete.markRead(thread.id, saved.id)
    expect(events).toHaveLength(4)
    await athlete.markRead(thread.id, saved.id)
    expect(events).toHaveLength(4)
    remove()
    await db.deleteFrom('chat_messages').where('id', '=', saved.id).execute()
  })
  it('uses the same direct conversation from both participants and concurrent opens', async () => {
    const threads = await Promise.all([coach.direct(2), athlete.direct(1), coach.direct(2)])
    expect(new Set(threads.map(t => t.id)).size).toBe(1)
    id = threads[0]!.id
  })
  it('validates input, stores literal text, and deduplicates a retried send', async () => {
    await expect(coach.send(id, '  ', 'empty')).rejects.toBeInstanceOf(MessagingError)
    await expect(coach.send(id, 'x'.repeat(4001), 'long')).rejects.toBeInstanceOf(MessagingError)
    const first = await coach.send(id, '<img onerror=alert(1)>', 'retry')
    expect((await coach.send(id, first.body, 'retry')).id).toBe(first.id)
    await expect(coach.send(id, 'different', 'retry')).rejects.toMatchObject({ status: 409 })
    expect((await athlete.list())[0]?.unread).toBe(1)
    expect((await coach.list())[0]?.unread).toBe(0)
  })
  it('paginates in chronological order and only marks through the acknowledged message', async () => {
    last = (await coach.send(id, 'Second', 'second')).id
    const later = await coach.send(id, 'Third', 'third')
    const page = await athlete.messages(id)
    expect(page.has_more).toBe(true)
    expect(page.messages.map(m => m.body)).toEqual(['Second', 'Third'])
    expect((await athlete.messages(id, last)).messages).toHaveLength(1)
    await athlete.markRead(id, last)
    expect((await athlete.list())[0]?.unread).toBe(1)
    expect((await coach.messages(id)).messages[0]?.read_at).not.toBeNull()
    await athlete.markRead(id, later.id)
    expect((await athlete.list())[0]?.unread).toBe(0)
  })
  it('denies outsiders, other tenants, revoked relationships, and disabled messaging', async () => {
    const outsider = createMessenger({ ...options, actorId: 3, authorize: () => true })
    await expect(outsider.messages(id)).rejects.toMatchObject({ status: 404 })
    const otherGym = createMessenger({ ...options, actorId: 1, scope: 'gym:2' })
    await expect(otherGym.messages(id)).rejects.toMatchObject({ status: 404 })
    await expect(createMessenger({ ...options, actorId: 1, enabled: false }).direct(2)).rejects.toMatchObject({ status: 403 })
    allowed = false
    expect(await coach.list()).toHaveLength(0)
    await expect(coach.send(id, 'No access', 'revoked')).rejects.toMatchObject({ status: 404 })
    await expect(athlete.markRead(id, last)).rejects.toMatchObject({ status: 404 })
    allowed = true
  })
  it('binds an opt-in model instance to its own identity', async () => {
    const Person = defineModel({ name: 'Person', table: 'people', traits: { useMessaging: true, useTimestamps: false }, attributes: { name: {} } })
    const person = await Person.find(1)
    const messenger = (person as any).messenger(options)
    expect((await messenger.direct(2)).recipient_id).toBe(2)
    const row = await db.selectFrom('chat_conversations').selectAll().where('participant_type', '=', 'people').executeTakeFirst()
    expect(Number(row?.first_id)).toBe(1)
  })
})
