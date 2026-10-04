import type { Fetch } from '../src/inbox'
import { describe, expect, it } from 'bun:test'
import { createInboxDriver, DiscordInboxDriver, formatJid, IMessageDriver, SlackInboxDriver, snowflakeTime, WhatsAppDriver } from '../src/inbox'
import { ALICE, BOB, FakeChatDb } from './fixtures/chat-db'
import { CLIMBERS, DANA, EMEKA, FakeChatStorage } from './fixtures/chat-storage'

describe('iMessage inbox driver', () => {
  function setup() {
    const chat = new FakeChatDb()
    const opened: string[] = []
    const driver = new IMessageDriver({
      databasePath: chat.path,
      addressBookDir: false,
      openUrl: url => opened.push(url),
    })
    return { chat, driver, opened }
  }

  it('lists conversations merged across services, with a cursor that moves on new messages', async () => {
    const { chat, driver } = setup()
    const imessage = chat.direct(ALICE)
    chat.add(imessage, { text: 'hi' })
    chat.add(chat.direct(ALICE, 'SMS'), { text: 'over sms', read: false })

    const [first] = await driver.conversations()
    expect(first!.id).toBe(`direct:${ALICE}`)
    expect(first!.provider).toBe('imessage')
    expect(first!.preview).toBe('over sms')
    expect(first!.unread).toBe(1)
    expect(first!.archive.mode).toBe('confirm')
    expect(first!.url).toBe(`sms:${ALICE}`)

    const before = first!.cursor
    chat.add(imessage, { text: 'again' })
    expect((await driver.conversations())[0]!.cursor).not.toBe(before)
  })

  it('reads messages after a cursor, with reactions as their emoji', async () => {
    const { chat, driver } = setup()
    const alice = chat.direct(ALICE)
    const first = chat.add(alice, { text: 'look' })
    chat.add(alice, { text: 'Loved “look”', reaction: { type: 2000, target: first }, fromMe: true })
    chat.add(alice, { text: 'Removed a heart', reaction: { type: 3000, target: first }, fromMe: true })

    const all = await driver.messages(`direct:${ALICE}`)
    expect(all.map(m => m.kind)).toEqual(['message', 'reaction', 'reaction'])
    expect(all[1]).toMatchObject({ reaction: '❤️', targetId: first, reactionRemoved: false, fromMe: true })
    expect(all[2]).toMatchObject({ reaction: '❤️', reactionRemoved: true })

    const later = await driver.messages(`direct:${ALICE}`, { after: all[0]!.cursor })
    expect(later).toHaveLength(2)
  })

  it('returns the most recent messages for a bare limit, oldest first', async () => {
    const { chat, driver } = setup()
    const alice = chat.direct(ALICE)
    for (const text of ['one', 'two', 'three', 'four'])
      chat.add(alice, { text })
    expect((await driver.messages(`direct:${ALICE}`, { limit: 2 })).map(m => m.text)).toEqual(['three', 'four'])
    expect((await driver.messages(`direct:${ALICE}`, { after: '0', limit: 2 })).map(m => m.text)).toEqual(['one', 'two'])
  })

  it('without a controller only opens Messages, and notices when it has gone', async () => {
    const { chat, driver, opened } = setup()
    const group = chat.group('chat9', [ALICE, BOB], { name: 'Trip', groupId: 'G-9' })
    chat.add(group, { text: 'packing list?' })

    const outcome = await driver.archive('group:G-9')
    expect(outcome).toMatchObject({ mode: 'confirm', removed: false })
    expect(opened).toEqual(['sms://open?groupid=G-9'])
    expect(outcome.detail).toContain('Conversation > Delete Conversation')

    chat.deleteChat(group)
    const [after] = await driver.conversations()
    expect(after!.visible).toBe(false)
    expect((await driver.archive('group:G-9')).removed).toBe(true)
  })

  it('hands a controller the row names Messages shows, and recovers through it', async () => {
    const chat = new FakeChatDb()
    const alice = chat.direct(ALICE)
    chat.add(alice, { text: 'hi' })
    const calls: string[] = []
    const driver = new IMessageDriver({
      databasePath: chat.path,
      addressBookDir: false,
      confirmDeletes: true,
      controller: {
        remove: async (names, url, confirm) => {
          calls.push(`remove ${names.join('|')} ${url} ${confirm}`)
          return { ok: true, detail: '' }
        },
        recover: async (names) => {
          calls.push(`recover ${names.join('|')}`)
          return { ok: true, detail: '' }
        },
      },
    })
    expect((await driver.archive(`direct:${ALICE}`)).detail).toBe('Deleted in Messages.')
    chat.deleteChat(alice)
    await driver.unarchive(`direct:${ALICE}`)
    expect(calls).toEqual([
      `remove +1 (555) 000-2222|${ALICE} sms:${ALICE} true`,
      `recover +1 (555) 000-2222|${ALICE}`,
    ])
  })

  // The platform is pinned: CI runs on Linux, where the honest answer is
  // "not a Mac" before the database is ever looked for.
  it('reads a conversation sitting in Recently Deleted when asked to', async () => {
    const { chat, driver } = setup()
    const alice = chat.direct(ALICE)
    chat.add(alice, { text: 'one' })
    chat.add(alice, { text: 'two', fromMe: true })
    chat.deleteChat(alice)

    const [conversation] = await driver.conversations()
    expect(conversation).toMatchObject({ visible: false, deleted: 2 })
    expect(await driver.messages(`direct:${ALICE}`)).toEqual([])
    expect((await driver.messages(`direct:${ALICE}`, { includeDeleted: true })).map(m => m.text)).toEqual(['one', 'two'])
  })

  it('gives a photo sent on its own no text, not the invisible placeholder', async () => {
    const { chat, driver } = setup()
    const alice = chat.direct(ALICE)
    chat.add(alice, { text: '\uFFFC', attachment: { name: 'IMG_1.HEIC', mime: 'image/heic' } })
    chat.add(alice, { text: 'look \uFFFC', attachment: { name: 'IMG_2.HEIC', mime: 'image/heic' } })
    const [photo, captioned] = await driver.messages(`direct:${ALICE}`)
    expect(photo!.text).toBeNull()
    expect(photo!.attachments).toHaveLength(1)
    expect(captioned!.text).toBe('look')
    expect((await driver.conversations())[0]!.preview).toBe('look')
  })

  it('reports a missing database as Messages not set up', async () => {
    const driver = new IMessageDriver({ databasePath: '/nonexistent/chat.db', addressBookDir: false, platform: 'darwin' })
    expect(await driver.status()).toMatchObject({ connected: false, needs: 'messages-signed-out' })
  })

  it('reports any other OS as unsupported, whatever the database', async () => {
    for (const platform of ['linux', 'win32'] as const) {
      const driver = new IMessageDriver({ databasePath: '/nonexistent/chat.db', addressBookDir: false, platform })
      expect(await driver.status()).toMatchObject({ connected: false, needs: 'unsupported-platform' })
    }
  })
})

/** A fake Slack Web API: answers by method name, records every call. */
function slackApi(handlers: Record<string, (params: URLSearchParams) => unknown>) {
  const calls: Array<{ method: string, params: URLSearchParams }> = []
  const fetch: Fetch = async (input, init) => {
    const url = new URL(input)
    const method = url.pathname.split('/').pop()!
    const params = init?.method === 'POST' ? new URLSearchParams(String(init.body)) : url.searchParams
    calls.push({ method, params })
    const handler = handlers[method]
    return Response.json(handler ? { ok: true, ...handler(params) as object } : { ok: false, error: 'unknown_method' })
  }
  return { fetch, calls }
}

describe('Slack inbox driver', () => {
  const base = {
    'auth.test': () => ({ user_id: 'UME', team: 'Acme', team_id: 'T1' }),
    'users.info': (p: URLSearchParams) => ({ user: { profile: { display_name: p.get('user') === 'UANN' ? 'Ann' : 'Ben' } } }),
    'users.conversations': () => ({ channels: [
      { id: 'D1', is_im: true, user: 'UANN' },
      { id: 'C1', is_channel: true, name: 'general' },
      { id: 'G1', is_group: true, is_private: true, name: 'leads' },
    ] }),
    'conversations.info': (p: URLSearchParams) => ({ channel: p.get('channel') === 'D1' ? { id: 'D1', is_im: true, is_open: true, user: 'UANN', unread_count_display: 2 } : { id: p.get('channel') } }),
    'conversations.history': (p: URLSearchParams) => p.get('limit') === '1'
      ? { messages: [{ ts: p.get('channel') === 'D1' ? '1700000300.000200' : '1700000100.000100', user: 'UANN', text: 'latest' }] }
      : { messages: [
          { ts: '1700000300.000200', user: 'UME', text: 'sure', reactions: [{ name: '+1', users: ['UANN'] }] },
          { ts: '1700000200.000100', user: 'UANN', text: 'lunch?', files: [{ id: 'F1', name: 'menu.pdf', mimetype: 'application/pdf', size: 10, url_private: 'https://files.slack.com/menu.pdf' }] },
        ] },
  }

  it('lists DMs and channels with what archiving does for each', async () => {
    const { fetch } = slackApi(base)
    const driver = new SlackInboxDriver({ token: 'xoxp-test', fetch })
    const conversations = await driver.conversations()
    const dm = conversations.find(c => c.id === 'D1')!
    expect(dm).toMatchObject({ kind: 'direct', workspace: 'Acme', unread: 2, visible: true, url: 'slack://channel?team=T1&id=D1' })
    expect(dm.participants).toEqual([{ id: 'UANN', name: 'Ann' }])
    expect(dm.archive.mode).toBe('native')
    expect(conversations.find(c => c.id === 'C1')!.archive.mode).toBe('native')
    expect(conversations.find(c => c.id === 'G1')!.archive.mode).toBe('unsupported')
    expect(conversations[0]!.id).toBe('D1')
  })

  it('reads history oldest first, with files and reactions', async () => {
    const { fetch, calls } = slackApi(base)
    const driver = new SlackInboxDriver({ token: 'xoxp-test', fetch })
    const messages = await driver.messages('D1', { after: '1700000000.000000' })
    expect(messages.map(m => m.text ?? m.reaction)).toEqual(['lunch?', 'sure', '👍'])
    expect(messages[0]!.attachments[0]).toMatchObject({ name: 'menu.pdf', url: 'https://files.slack.com/menu.pdf' })
    expect(messages[1]!.fromMe).toBe(true)
    expect(messages[2]).toMatchObject({ kind: 'reaction', targetId: '1700000300.000200', sender: { id: 'UANN', name: 'Ann' } })
    const history = calls.find(c => c.method === 'conversations.history')!
    expect(history.params.get('oldest')).toBe('1700000000.000000')
  })

  it('closes a DM, leaves a public channel, and leaves a private one alone', async () => {
    const { fetch, calls } = slackApi({
      ...base,
      'conversations.info': (p: URLSearchParams) => ({ channel: { D1: { id: 'D1', is_im: true }, C1: { id: 'C1', name: 'general' }, G1: { id: 'G1', is_private: true } }[p.get('channel')!] }),
      'conversations.close': () => ({}),
      'conversations.leave': () => ({}),
      'conversations.open': () => ({}),
      'conversations.join': () => ({}),
    })
    const driver = new SlackInboxDriver({ token: 'xoxp-test', fetch })
    expect(await driver.archive('D1')).toMatchObject({ mode: 'native', removed: true })
    expect(await driver.archive('C1')).toMatchObject({ mode: 'native', removed: true })
    expect(await driver.archive('G1')).toMatchObject({ mode: 'unsupported', removed: false })
    await driver.unarchive('D1')
    await driver.unarchive('C1')
    expect(calls.map(c => c.method).filter(m => /close|leave|open|join/.test(m))).toEqual(['conversations.close', 'conversations.leave', 'conversations.open', 'conversations.join'])
  })

  it('reports a bad token instead of throwing', async () => {
    const fetch: Fetch = async () => Response.json({ ok: false, error: 'invalid_auth' })
    const driver = new SlackInboxDriver({ token: 'xoxp-bad', fetch })
    expect(await driver.status()).toMatchObject({ connected: false, needs: 'token' })
  })

  it('fetches private files with the token', async () => {
    let auth = ''
    const fetch: Fetch = async (_input, init) => {
      auth = new Headers(init?.headers).get('authorization') ?? ''
      return new Response('pdf')
    }
    const driver = new SlackInboxDriver({ token: 'xoxp-test', fetch })
    await driver.attachment({ id: 'F1', name: 'menu.pdf', mimeType: null, bytes: 3, path: null, url: 'https://files.slack.com/menu.pdf' })
    expect(auth).toBe('Bearer xoxp-test')
  })
})

describe('Discord inbox driver', () => {
  const now = Date.UTC(2026, 9, 1)
  // A snowflake for a given time.
  const flake = (ms: number) => String((BigInt(ms) - 1_420_070_400_000n) << 22n)

  function discordApi() {
    const calls: Array<{ method: string, path: string, body?: string }> = []
    const fetch: Fetch = async (input, init) => {
      const path = new URL(input).pathname.replace('/api/v10', '') + new URL(input).search
      calls.push({ method: init?.method ?? 'GET', path, body: init?.body as string | undefined })
      if (path === '/users/@me')
        return Response.json({ username: 'attic-bot' })
      if (path === '/users/@me/guilds')
        return Response.json([{ id: 'G1', name: 'Climbers' }])
      if (path === '/guilds/G1/channels')
        return Response.json([{ id: 'C1', type: 0, name: 'general', last_message_id: flake(now) }, { id: 'V1', type: 2, name: 'voice' }])
      if (path === '/guilds/G1/threads/active')
        return Response.json({ threads: [{ id: 'T1', type: 11, name: 'Trip planning', parent_id: 'C1', last_message_id: flake(now - 1000), thread_metadata: { archived: false } }] })
      if (path.startsWith('/channels/C1/messages?limit=1'))
        return Response.json([{ id: flake(now), type: 0, content: 'hello', timestamp: new Date(now).toISOString(), edited_timestamp: null, author: { id: 'U2', username: 'ann' } }])
      if (path.startsWith('/channels/T1/messages?limit=100'))
        return Response.json([
          { id: flake(now - 1000), type: 0, content: 'second', timestamp: new Date(now - 1000).toISOString(), edited_timestamp: null, author: { id: 'UME', username: 'me' }, reactions: [{ count: 2, emoji: { id: null, name: '🔥' } }] },
          { id: flake(now - 2000), type: 0, content: 'first', timestamp: new Date(now - 2000).toISOString(), edited_timestamp: null, author: { id: 'U2', username: 'ann', global_name: 'Ann' }, attachments: [{ id: 'A1', filename: 'map.png', content_type: 'image/png', size: 5, url: 'https://cdn.discordapp.com/map.png' }] },
        ])
      if (path.startsWith('/channels/T1/messages'))
        return Response.json([{ id: flake(now - 1000), type: 0, content: 'second', timestamp: new Date(now - 1000).toISOString(), edited_timestamp: null, author: { id: 'UME', username: 'me' } }])
      if (path === '/channels/T1' && init?.method === 'PATCH')
        return Response.json({ id: 'T1' })
      return new Response('{}', { status: 404 })
    }
    return { fetch, calls }
  }

  it('lists text channels and active threads, not voice, without DMs', async () => {
    const { fetch } = discordApi()
    const driver = new DiscordInboxDriver({ token: 'bot', userId: 'UME', fetch })
    const conversations = await driver.conversations()
    expect(conversations.map(c => c.id)).toEqual(['C1', 'T1'])
    expect(conversations[0]).toMatchObject({ kind: 'channel', title: '#general', workspace: 'Climbers', preview: 'hello', url: 'https://discord.com/channels/G1/C1' })
    expect(conversations[0]!.archive.mode).toBe('unsupported')
    expect(conversations[1]).toMatchObject({ kind: 'thread', title: 'Trip planning', visible: true })
    expect(conversations[1]!.archive.mode).toBe('native')
  })

  it('reads messages oldest first, with attachments and reaction counts', async () => {
    const { fetch } = discordApi()
    const driver = new DiscordInboxDriver({ token: 'bot', userId: 'UME', fetch })
    const messages = await driver.messages('T1')
    expect(messages.map(m => m.text ?? m.reaction)).toEqual(['first', 'second', '2'])
    expect(messages[0]!.sender).toEqual({ id: 'U2', name: 'Ann' })
    expect(messages[1]!.fromMe).toBe(true)
    expect(messages[2]).toMatchObject({ kind: 'reaction', reaction: '🔥' })
  })

  it('archives a thread in Discord and refuses a channel', async () => {
    const { fetch, calls } = discordApi()
    const driver = new DiscordInboxDriver({ token: 'bot', fetch })
    await driver.conversations()
    expect(await driver.archive('T1')).toMatchObject({ mode: 'native', removed: true })
    expect(calls.find(c => c.method === 'PATCH')).toMatchObject({ path: '/channels/T1', body: '{"archived":true}' })
    expect(await driver.archive('C1')).toMatchObject({ mode: 'unsupported', removed: false })
  })

  it('reads a snowflake as a time', () => {
    expect(snowflakeTime(flake(now))).toBe(now)
    expect(snowflakeTime(null)).toBeNull()
  })
})

describe('WhatsApp inbox driver', () => {
  function setup(controller?: { archive?: boolean, unarchive?: boolean }) {
    const store = new FakeChatStorage()
    const opened: string[] = []
    const asked: Array<{ verb: string, names: string[] }> = []
    const driver = new WhatsAppDriver({
      databasePath: store.path,
      platform: 'darwin',
      openUrl: url => opened.push(url),
      settleMs: 500,
      controller: controller && {
        archive: async (names) => {
          asked.push({ verb: 'archive', names })
          if (controller.archive)
            store.setArchived(DANA, true)
          return { ok: true, detail: 'pressed' }
        },
        unarchive: async (names) => {
          asked.push({ verb: 'unarchive', names })
          if (controller.unarchive)
            store.setArchived(DANA, false)
          return { ok: true, detail: 'pressed' }
        },
      },
    })
    return { store, driver, opened, asked }
  }

  it('lists direct chats and groups, not status updates, archived ones as not visible', async () => {
    const { store, driver } = setup()
    const dana = store.chat(DANA, 'Dana Reyes')
    store.add(dana, { text: 'see you at 6' })
    const group = store.chat(CLIMBERS, 'Weekend Climbers', 1)
    store.member(group, EMEKA, 'Emeka')
    store.add(group, { text: 'rope check', member: EMEKA })
    store.add(store.chat('status@broadcast', 'Status', 3), { text: 'story' })
    store.setArchived(CLIMBERS, true)

    const conversations = await driver.conversations()
    expect(conversations.map(c => c.id).sort()).toEqual([CLIMBERS, DANA].sort())
    const direct = conversations.find(c => c.id === DANA)!
    expect(direct).toMatchObject({ provider: 'whatsapp', kind: 'direct', title: null, preview: 'see you at 6', visible: true, url: 'whatsapp://send?phone=15550004444' })
    expect(direct.participants).toEqual([{ id: DANA, name: 'Dana Reyes' }])
    expect(direct.archive.mode).toBe('confirm')
    const climbers = conversations.find(c => c.id === CLIMBERS)!
    expect(climbers).toMatchObject({ kind: 'group', title: 'Weekend Climbers', visible: false, url: null })
    expect(climbers.archive.mode).toBe('unsupported')
    expect(climbers.participants).toEqual([{ id: EMEKA, name: 'Emeka' }])
  })

  it('reads every kind of message the way WhatsApp shows it', async () => {
    const { store, driver } = setup()
    const group = store.chat(CLIMBERS, 'Weekend Climbers', 1)
    store.member(group, EMEKA, null, 'emeka.o')
    store.add(group, { text: 'hello\uFFFC', member: EMEKA })
    store.add(group, { type: 1, fromMe: true, media: { path: 'Media/120363000000000001@g.us/a/b/photo.jpg', mime: 'image/jpeg', title: 'the crag', bytes: 4, file: 'jpeg' } })
    store.add(group, { type: 3, member: EMEKA, media: { path: 'Media/120363000000000001@g.us/c/d/voice.opus', mime: 'audio/ogg; codecs=opus', bytes: 2 } })
    store.add(group, { type: 8, member: EMEKA, text: 'topo.pdf', media: { path: 'Media/120363000000000001@g.us/e/f/x1.pdf', mime: 'application/pdf', title: 'Topo guide' } })
    store.add(group, { type: 4, member: EMEKA, media: { vcard: 'BEGIN:VCARD\nVERSION:3.0\nFN:Lena Brandt\nEND:VCARD' } })
    store.add(group, { type: 5, member: EMEKA, media: { lat: 37.75, lon: -119.59, title: 'Half Dome' } })
    store.add(group, { type: 6, text: 'Emeka changed the group name' })
    store.add(group, { type: 14, member: EMEKA })
    store.add(group, { type: 66, member: EMEKA, media: {} })
    store.add(group, { type: 1, member: EMEKA, media: { mime: 'image/jpeg', bytes: 900 } })

    const messages = await driver.messages(CLIMBERS)
    expect(messages.map(m => [m.kind, m.text])).toEqual([
      ['message', 'hello'],
      ['message', 'the crag'],
      ['message', null],
      ['message', null],
      ['message', 'Contact card: Lena Brandt'],
      ['message', 'Half Dome https://maps.apple.com/?ll=37.75,-119.59'],
      ['event', 'Emeka changed the group name'],
      ['message', null],
      ['event', null],
      ['message', null],
    ])
    expect(messages[0]!.sender).toEqual({ id: EMEKA, name: 'emeka.o' })
    expect(messages[1]).toMatchObject({ fromMe: true, sender: null })
    expect(messages[1]!.attachments[0]).toMatchObject({ name: 'photo.jpg', mimeType: 'image/jpeg', bytes: 4 })
    expect(messages[1]!.attachments[0]!.path).toBe(`${store.dir}/Message/Media/120363000000000001@g.us/a/b/photo.jpg`)
    expect(messages[2]!.attachments[0]).toMatchObject({ mimeType: 'audio/ogg', path: null })
    expect(messages[3]!.attachments[0]!.name).toBe('Topo guide')
    expect(messages[7]!.unsent).toBe(true)
    // A photo WhatsApp never downloaded is still a photo, not an empty bubble.
    expect(messages[9]!.attachments).toEqual([{ id: expect.any(String), name: 'Photo', mimeType: 'image/jpeg', bytes: 900, path: null, url: null }])
    expect(await (await driver.attachment(messages[1]!.attachments[0]!)).text()).toBe('jpeg')
  })

  it('reads forward from a cursor, and the newest for a bare limit, oldest first', async () => {
    const { store, driver } = setup()
    const dana = store.chat(DANA, 'Dana Reyes')
    for (const text of ['one', 'two', 'three', 'four'])
      store.add(dana, { text })
    const all = await driver.messages(DANA)
    expect((await driver.messages(DANA, { after: all[1]!.cursor })).map(m => m.text)).toEqual(['three', 'four'])
    expect((await driver.messages(DANA, { limit: 2 })).map(m => m.text)).toEqual(['three', 'four'])
    expect(all[0]!.sender).toEqual({ id: DANA, name: 'Dana Reyes' })
  })

  it('archives through WhatsApp and only reports it removed once WhatsApp has recorded it', async () => {
    const { store, driver, asked } = setup({ archive: true, unarchive: true })
    store.add(store.chat(DANA, 'Dana Reyes'), { text: 'hi' })

    expect((await driver.conversations())[0]!.archive.mode).toBe('native')
    expect(await driver.archive(DANA)).toMatchObject({ mode: 'native', removed: true })
    expect(asked[0]).toEqual({ verb: 'archive', names: ['Dana Reyes', '+15550004444'] })
    expect((await driver.conversations())[0]!.visible).toBe(false)

    await driver.unarchive(DANA)
    expect(asked[1]!.verb).toBe('unarchive')
    expect((await driver.conversations())[0]!.visible).toBe(true)
  })

  it('does not claim an archive WhatsApp never recorded', async () => {
    const { store, driver } = setup({ archive: false })
    store.add(store.chat(DANA, 'Dana Reyes'), { text: 'hi' })
    expect(await driver.archive(DANA)).toMatchObject({ mode: 'native', removed: false, detail: 'WhatsApp did not record the archive.' })
  })

  it('without a controller opens the chat for the person to archive', async () => {
    const { store, driver, opened } = setup()
    store.add(store.chat(DANA, 'Dana Reyes'), { text: 'hi' })
    expect(await driver.archive(DANA)).toMatchObject({ mode: 'confirm', removed: false })
    expect(opened).toEqual(['whatsapp://send?phone=15550004444'])
  })

  it('reports what is missing instead of throwing', async () => {
    expect((await new WhatsAppDriver({ databasePath: '/nonexistent/ChatStorage.sqlite', platform: 'darwin' }).status()).needs).toBe('signed-out')
    expect((await new WhatsAppDriver({ platform: 'linux' }).status()).needs).toBe('unsupported-platform')
    expect(formatJid(DANA)).toBe('+15550004444')
    expect(formatJid(CLIMBERS)).toBe('120363000000000001')
  })
})

describe('createInboxDriver', () => {
  it('builds each driver by name', () => {
    expect(createInboxDriver('imessage', { addressBookDir: false }).label).toBe('iMessage')
    expect(createInboxDriver('slack', { token: 'x' }).provider).toBe('slack')
    expect(createInboxDriver('discord', { token: 'x' }).provider).toBe('discord')
    expect(createInboxDriver('whatsapp', {}).label).toBe('WhatsApp')
  })
})
