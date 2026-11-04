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
  it('carries attachments, takes a photo with no caption, and tells a retry from a new message', async () => {
    const photo = [{ file: 'a1b2c3d4.jpeg', type: 'image/jpeg', size: 2048, width: 100, height: 200 }]
    const sent = await coach.send(id, '', 'photo', photo)
    expect(sent.body).toBe('')
    expect(sent.attachments).toEqual(photo)
    // Read back out of the column rather than out of the call that wrote it.
    expect((await athlete.messages(id)).messages.at(-1)?.attachments).toEqual(photo)
    // The same key with the same photo is the same message.
    expect((await coach.send(id, '', 'photo', photo)).id).toBe(sent.id)
    // The same key with a different photo is a different message, and keeping
    // the first one silently would lose the second.
    await expect(coach.send(id, '', 'photo', [{ file: 'other.jpeg' }])).rejects.toMatchObject({ status: 409 })
    // Text-only messages read as an empty list, never null.
    expect((await coach.send(id, 'Just words', 'words')).attachments).toEqual([])
  })

  it('keeps the name a document was sent under, beside the stored file (#3022)', async () => {
    const plan = [{ file: '9337c5e381d28329b843b53d20194d0b.pdf', type: 'application/pdf', name: '  Week 42 plan.pdf ', size: 383 }]
    const sent = await coach.send(id, '', 'plan', plan)
    const kept = [{ file: '9337c5e381d28329b843b53d20194d0b.pdf', type: 'application/pdf', name: 'Week 42 plan.pdf', size: 383 }]
    expect(sent.attachments).toEqual(kept)
    // Read back out of the column, which is where the name used to go missing.
    expect((await athlete.messages(id)).messages.at(-1)?.attachments).toEqual(kept)
    await expect(coach.send(id, 'ok', 'blank-name', [{ file: 'a.pdf', name: '   ' }])).rejects.toMatchObject({ status: 422 })
    await expect(coach.send(id, 'ok', 'long-name', [{ file: 'a.pdf', name: 'x'.repeat(256) }])).rejects.toMatchObject({ status: 422 })
    await expect(coach.send(id, 'ok', 'odd-name', [{ file: 'a.pdf', name: 42 as any }])).rejects.toMatchObject({ status: 422 })
  })

  it('refuses attachments it cannot record, and stores only the keys it knows', async () => {
    const many = Array.from({ length: 11 }, (_, i) => ({ file: `${i}.jpeg` }))
    await expect(coach.send(id, '   ', 'nothing', [])).rejects.toMatchObject({ status: 422 })
    await expect(coach.send(id, 'ok', 'not-a-list', 'nope' as any)).rejects.toMatchObject({ status: 422 })
    await expect(coach.send(id, 'ok', 'too-many', many)).rejects.toMatchObject({ status: 422 })
    await expect(coach.send(id, 'ok', 'no-file', [{ file: '  ' }])).rejects.toMatchObject({ status: 422 })
    await expect(coach.send(id, 'ok', 'bad-size', [{ file: 'a.jpeg', size: -1 }])).rejects.toMatchObject({ status: 422 })
    await expect(coach.send(id, 'ok', 'long', [{ file: 'a.jpeg', type: 'x'.repeat(256) }])).rejects.toMatchObject({ status: 422 })
    // A key the trait does not know is refused, not dropped: the column cannot
    // become a second message body, and the caller hears it at the call
    // instead of finding the value missing later (#3022).
    await expect(coach.send(id, 'with extras', 'extras', [{ file: 'b.jpeg', secret: 'do not store me' } as any])).rejects.toMatchObject({ status: 422, message: expect.stringContaining('`secret`') })
    await expect(coach.send(id, 'with bytes', 'bytes', [{ file: 'b.pdf', bytes: 383 } as any])).rejects.toMatchObject({ status: 422 })
    expect((await athlete.messages(id)).messages.some(message => message.body === 'with extras' || message.body === 'with bytes')).toBe(false)
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

/**
 * Taking a message back, and rewriting one.
 *
 * Both are the sender's alone, and both have to leave the thread coherent:
 * an unsent message keeps its row so ordering, read receipts and the retry
 * key still refer to something, while the words it carried stop existing.
 */
describe('changing a message after it is sent', () => {
  it('rewrites your own message and says it was edited', async () => {
    const thread = await coach.direct(2)
    const sent = await coach.send(thread.id, 'Six oclock', 'edit-typo')
    expect(sent.edited_at).toBeNull()

    const fixed = await coach.edit(thread.id, sent.id, "Six o'clock")
    expect(fixed.body).toBe("Six o'clock")
    expect(fixed.edited_at).not.toBeNull()
    expect(fixed.id).toBe(sent.id)

    // The other side reads the new words, not the delivered ones.
    const seen = await athlete.messages(thread.id)
    expect(seen.messages.find(m => m.id === sent.id)?.body).toBe("Six o'clock")
  })

  it('refuses to edit a message into nothing', async () => {
    const thread = await coach.direct(2)
    const sent = await coach.send(thread.id, 'Still here', 'edit-empty')
    // Removing every word is unsending it, which is a different thing to ask.
    await expect(coach.edit(thread.id, sent.id, '   ')).rejects.toThrow(MessagingError)
    expect((await athlete.messages(thread.id)).messages.find(m => m.id === sent.id)?.body).toBe('Still here')
  })

  it('loses the words of an unsent message but keeps its place', async () => {
    const thread = await coach.direct(2)
    const sent = await coach.send(thread.id, 'Sent to the wrong person', 'unsend-mistake')
    const gone = await coach.unsend(thread.id, sent.id)
    expect(gone.deleted_at).not.toBeNull()
    expect(gone.body).toBe('')
    expect(gone.attachments).toEqual([])

    // The row is still the row: the reader sees a message that was taken back,
    // in the place it occupied, rather than the thread silently reshuffling.
    const seen = await athlete.messages(thread.id)
    const row = seen.messages.find(m => m.id === sent.id)
    expect(row?.deleted_at).not.toBeNull()
    expect(row?.body).toBe('')

    // And it is gone from the database, not merely hidden by the reader.
    const stored = await db.selectFrom('chat_messages').select(['body']).where('id', '=', sent.id).executeTakeFirst()
    expect(String(stored?.body ?? '')).toBe('')
  })

  it('will not change someone else’s message, or say whether it exists', async () => {
    const thread = await coach.direct(2)
    const theirs = await athlete.send(thread.id, 'Mine, not yours', 'unsend-theirs')
    // Not found rather than forbidden: which of your peer's messages exist is
    // not something an error should disclose.
    await expect(coach.unsend(thread.id, theirs.id)).rejects.toThrow('Message not found')
    await expect(coach.edit(thread.id, theirs.id, 'Rewritten')).rejects.toThrow('Message not found')
    expect((await athlete.messages(thread.id)).messages.find(m => m.id === theirs.id)?.body).toBe('Mine, not yours')
  })

  it('will not unsend the same message twice, or edit one already taken back', async () => {
    const thread = await coach.direct(2)
    const sent = await coach.send(thread.id, 'Going away', 'unsend-once')
    await coach.unsend(thread.id, sent.id)
    await expect(coach.unsend(thread.id, sent.id)).rejects.toThrow('This message was unsent')
    await expect(coach.edit(thread.id, sent.id, 'Back again')).rejects.toThrow('This message was unsent')
  })

  it('stops accepting changes once the application’s window has passed', async () => {
    const brief = createMessenger({ ...options, actorId: 1, changeWindowMs: -1 })
    const thread = await brief.direct(2)
    const sent = await brief.send(thread.id, 'Too late already', 'window-closed')
    await expect(brief.edit(thread.id, sent.id, 'Changed')).rejects.toThrow('no longer be changed')
    await expect(brief.unsend(thread.id, sent.id)).rejects.toThrow('no longer be changed')
    // Without a window configured the same message is still the sender's.
    expect((await coach.edit(thread.id, sent.id, 'Changed')).body).toBe('Changed')
  })
})
