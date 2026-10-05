import type { ArchiveOutcome, ArchiveSupport, Fetch, InboxAttachment, InboxCapabilities, InboxConversation, InboxDriver, InboxEvent, InboxMessage, InboxPerson, InboxStatus, MessageQuery, OutgoingMessage, SendOutcome } from './types'
import { onHost } from './image'

export interface SlackInboxConfig {
  /**
   * A user token (`xoxp-…`), so the inbox sees what the person sees. Scopes:
   * `channels:read groups:read im:read mpim:read channels:history
   * groups:history im:history mpim:history users:read im:write mpim:write
   * channels:write` (the last three for archiving), and to write as the
   * person: `chat:write reactions:read reactions:write files:read files:write
   * im:write mpim:write channels:write groups:write`.
   */
  token: string
  /**
   * An app-level token (`xapp-…`, scope `connections:write`) for Socket
   * Mode, so new messages arrive as they are sent. The app subscribes to
   * events on behalf of users: message.im, message.mpim, message.channels,
   * message.groups, reaction_added, reaction_removed. Without it the inbox
   * is read on a timer instead.
   */
  appToken?: string
  /** The WebSocket constructor for Socket Mode; the global one by default. */
  WebSocket?: new (url: string) => WebSocket
  fetch?: Fetch
  /** Overridable for tests and proxies. */
  apiBase?: string
  /** How many conversations' latest messages are fetched at once. */
  concurrency?: number
}

interface SlackChannel {
  id: string
  name?: string
  is_im?: boolean
  is_mpim?: boolean
  is_private?: boolean
  is_channel?: boolean
  is_group?: boolean
  is_archived?: boolean
  is_open?: boolean
  user?: string
  unread_count_display?: number
  last_read?: string
}

interface SlackFile {
  id: string
  name?: string
  title?: string
  mimetype?: string
  size?: number
  url_private?: string
}

interface SlackMessage {
  ts: string
  type?: string
  subtype?: string
  user?: string
  bot_id?: string
  username?: string
  text?: string
  edited?: { ts: string }
  thread_ts?: string
  files?: SlackFile[]
  reactions?: Array<{ name: string, users?: string[], count?: number }>
}

const CHANNEL_TYPES = 'im,mpim,public_channel,private_channel'

/** Slack's `:shortcode:` names for the common reactions; the rest stay as shortcodes. */
const EMOJI: Record<string, string> = {
  '+1': '👍',
  'thumbsup': '👍',
  '-1': '👎',
  'heart': '❤️',
  'joy': '😂',
  'laughing': '😆',
  'tada': '🎉',
  'eyes': '👀',
  'fire': '🔥',
  'white_check_mark': '✅',
  'pray': '🙏',
  'raised_hands': '🙌',
  'rocket': '🚀',
}

const tsToMs = (ts: string): number => Math.round(Number(ts) * 1000)

/** What Socket Mode sends down the socket. */
interface SocketEnvelope {
  type?: string
  envelope_id?: string
  payload?: { event?: SlackEvent }
}

/** An event Socket Mode delivers. */
interface SlackEvent {
  type: string
  subtype?: string
  channel?: string
  user?: string
  ts?: string
  text?: string
  thread_ts?: string
  item?: { channel?: string, ts?: string }
}

/** The Slack name for a reaction: the shortcode for a known emoji, or `:name:` as given. */
function shortcodeFor(reaction: string): string {
  const known = Object.entries(EMOJI).find(([, emoji]) => emoji === reaction)
  if (known)
    return known[0]
  const code = reaction.match(/^:([\w+-]+):$/)
  if (code)
    return code[1]!
  throw new Error(`Slack has no name for the reaction ${reaction}.`)
}

export class SlackApiError extends Error {
  constructor(public readonly method: string, public readonly code: string) {
    super(`Slack ${method} failed: ${code}`)
    this.name = 'SlackApiError'
  }
}

/**
 * Slack, through the Web API with the person's own user token.
 *
 * Archiving maps onto what Slack can do for one person. A DM or group DM is
 * closed (`conversations.close`): it leaves the sidebar, and Slack reopens it
 * by itself when someone writes - an email archive's behaviour exactly. A
 * public channel is left (and rejoined on unarchive). A private channel is
 * not touched: leaving it would need someone to invite the person back.
 */
export class SlackInboxDriver implements InboxDriver {
  readonly provider = 'slack' as const
  readonly label = 'Slack'
  private readonly token: string
  private readonly fetch: Fetch
  private readonly apiBase: string
  private readonly concurrency: number
  private readonly appToken: string | undefined
  private readonly Socket: (new (url: string) => WebSocket) | undefined
  private self: { userId: string, team: string, teamId: string } | null = null
  private users = new Map<string, string | null>()
  private avatars = new Map<string, string | null>()
  private channels = new Map<string, SlackChannel>()

  constructor(config: SlackInboxConfig) {
    this.token = config.token
    this.fetch = config.fetch ?? ((input, init) => fetch(input, init))
    this.apiBase = (config.apiBase ?? 'https://slack.com/api').replace(/\/$/, '')
    this.concurrency = config.concurrency ?? 4
    this.appToken = config.appToken
    this.Socket = config.WebSocket ?? (globalThis as { WebSocket?: new (url: string) => WebSocket }).WebSocket
  }

  capabilities(): InboxCapabilities {
    return { send: true, attachments: true, replies: true, reactions: true, markRead: true, live: !!this.appToken }
  }

  /**
   * Posts as the person (a user token writes as its user). A reply goes into
   * the thread of the message it answers; files go up through Slack's
   * external upload, with the text as their comment.
   */
  async send(conversationId: string, message: OutgoingMessage): Promise<SendOutcome> {
    const text = message.text?.trim() ?? ''
    const files = message.files ?? []
    if (!text && files.length === 0)
      throw new Error('Nothing to send.')
    const threadTs = message.replyToId ? await this.threadOf(conversationId, message.replyToId) : null
    if (files.length === 0) {
      const sent = await this.api<{ ts: string }>('chat.postMessage', { channel: conversationId, text, ...(threadTs ? { thread_ts: threadTs } : {}) }, true)
      return { id: sent.ts, sentAt: tsToMs(sent.ts) }
    }
    const uploaded: Array<{ id: string, title: string }> = []
    for (const file of files) {
      const bytes = await Bun.file(file.path).arrayBuffer()
      const name = file.name ?? file.path.split('/').pop() ?? 'file'
      const target = await this.api<{ upload_url: string, file_id: string }>('files.getUploadURLExternal', { filename: name, length: bytes.byteLength }, true)
      const put = await this.fetch(target.upload_url, { method: 'POST', body: new Blob([bytes], { type: file.mimeType ?? 'application/octet-stream' }) })
      if (!put.ok)
        throw new Error(`Slack did not take the upload of ${name}: ${put.status}`)
      uploaded.push({ id: target.file_id, title: name })
    }
    await this.api('files.completeUploadExternal', {
      files: JSON.stringify(uploaded),
      channel_id: conversationId,
      ...(text ? { initial_comment: text } : {}),
      ...(threadTs ? { thread_ts: threadTs } : {}),
    }, true)
    return { id: null, sentAt: Date.now() }
  }

  /** The thread a reply joins: the answered message's own thread, or that message. */
  private async threadOf(conversationId: string, ts: string): Promise<string> {
    try {
      const page = await this.api<{ messages: SlackMessage[] }>('conversations.history', { channel: conversationId, latest: ts, inclusive: true, limit: 1 })
      return page.messages[0]?.thread_ts ?? ts
    }
    catch {
      return ts
    }
  }

  async react(conversationId: string, messageId: string, reaction: string, remove = false): Promise<void> {
    const name = shortcodeFor(reaction)
    // Reactions arrive as `<ts>:<name>:<user>`; the message is the first part.
    const timestamp = messageId.split(':')[0]!
    await this.api(remove ? 'reactions.remove' : 'reactions.add', { channel: conversationId, timestamp, name }, true)
  }

  async markRead(conversationId: string): Promise<void> {
    const page = await this.api<{ messages: SlackMessage[] }>('conversations.history', { channel: conversationId, limit: 1 })
    const latest = page.messages[0]
    if (latest)
      await this.api('conversations.mark', { channel: conversationId, ts: latest.ts }, true)
  }

  /**
   * Socket Mode: Slack pushes each event down a WebSocket, which is
   * acknowledged by its envelope id. Slack closes the socket from time to
   * time and says so; it is reopened, backing off when it keeps failing.
   */
  watch(onEvent: (event: InboxEvent) => void): () => void {
    const Socket = this.Socket
    if (!this.appToken || !Socket)
      return () => {}
    let stopped = false
    let socket: WebSocket | null = null
    let failures = 0
    const connect = async (): Promise<void> => {
      if (stopped)
        return
      try {
        const response = await this.fetch(`${this.apiBase}/apps.connections.open`, { method: 'POST', headers: { authorization: `Bearer ${this.appToken}` } })
        const opened = await response.json() as { ok?: boolean, url?: string, error?: string }
        if (!opened.ok || !opened.url)
          throw new SlackApiError('apps.connections.open', opened.error ?? `http_${response.status}`)
        const current = new Socket(opened.url)
        socket = current
        // In order: a message waits on a user lookup, and the reaction to it
        // must not overtake it.
        let queue = Promise.resolve()
        current.onmessage = (raw) => {
          failures = 0
          let envelope: SocketEnvelope
          try {
            envelope = JSON.parse(String(raw.data))
          }
          catch {
            return
          }
          // At once, not behind the queue: Slack retries an envelope that is
          // not acknowledged within three seconds.
          if (envelope.envelope_id)
            current.send(JSON.stringify({ envelope_id: envelope.envelope_id }))
          if (envelope.type === 'disconnect') {
            current.close()
            return
          }
          queue = queue.then(() => this.onEnvelope(envelope, onEvent)).catch(() => {})
        }
        current.onclose = () => {
          socket = null
          if (!stopped)
            setTimeout(connect, Math.min(60_000, 1000 * 2 ** Math.min(failures++, 6)))
        }
      }
      catch {
        if (!stopped)
          setTimeout(connect, Math.min(60_000, 1000 * 2 ** Math.min(failures++, 6)))
      }
    }
    void connect()
    return () => {
      stopped = true
      socket?.close()
    }
  }

  private async onEnvelope(envelope: SocketEnvelope, onEvent: (event: InboxEvent) => void): Promise<void> {
    const event = envelope.payload?.event
    if (envelope.type !== 'events_api' || !event)
      return
    if (event.type === 'message' && event.channel && !event.subtype && event.ts) {
      const message = await this.toMessage(event.channel, event as SlackMessage)
      onEvent({ type: 'message', conversationId: event.channel, message })
      return
    }
    const channel = event.channel ?? event.item?.channel ?? null
    onEvent({ type: 'changed', conversationId: channel })
  }

  private async api<T extends Record<string, unknown>>(method: string, params: Record<string, string | number | boolean> = {}, post = false): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      const body = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))
      const response = post
        ? await this.fetch(`${this.apiBase}/${method}`, { method: 'POST', headers: { 'authorization': `Bearer ${this.token}`, 'content-type': 'application/x-www-form-urlencoded' }, body: body.toString() })
        : await this.fetch(`${this.apiBase}/${method}?${body}`, { headers: { authorization: `Bearer ${this.token}` } })
      // Rate limited: Slack says how long to wait. Three tries, then give up.
      if (response.status === 429 && attempt < 3) {
        await Bun.sleep(Math.min(30, Number(response.headers.get('retry-after')) || 1) * 1000)
        continue
      }
      const data = await response.json() as T & { ok?: boolean, error?: string }
      if (!data.ok)
        throw new SlackApiError(method, data.error ?? `http_${response.status}`)
      return data
    }
  }

  private async whoami(): Promise<{ userId: string, team: string, teamId: string }> {
    if (!this.self) {
      const me = await this.api<{ user_id: string, team: string, team_id: string }>('auth.test')
      this.self = { userId: me.user_id, team: me.team, teamId: me.team_id }
    }
    return this.self
  }

  private async userName(id: string | undefined): Promise<string | null> {
    if (!id)
      return null
    if (!this.users.has(id)) {
      try {
        const { user } = await this.api<{ user: { real_name?: string, name?: string, profile?: { display_name?: string, real_name?: string, image_72?: string, is_custom_image?: boolean } } }>('users.info', { user: id })
        this.users.set(id, user.profile?.display_name || user.profile?.real_name || user.real_name || user.name || null)
        this.avatars.set(id, user.profile?.image_72 ?? null)
      }
      catch {
        this.users.set(id, null)
      }
    }
    return this.users.get(id) ?? null
  }

  private async person(id: string | undefined): Promise<InboxPerson | null> {
    if (!id)
      return null
    const name = await this.userName(id)
    return { id, name, avatar: this.avatars.get(id) ?? null }
  }

  /** A profile picture: the reference is Slack's own image URL, fetched only from Slack's hosts. */
  async avatar(ref: string): Promise<Response> {
    if (!onHost(ref, ['slack-edge.com', 'slack.com', 'gravatar.com']))
      return new Response('Not found', { status: 404 })
    return this.fetch(ref)
  }

  async status(): Promise<InboxStatus> {
    if (!this.token)
      return { connected: false, detail: 'Add a Slack user token.', needs: 'token' }
    try {
      const me = await this.whoami()
      return { connected: true, detail: `Signed in to ${me.team}.` }
    }
    catch (error) {
      return { connected: false, detail: error instanceof Error ? error.message : String(error), needs: 'token' }
    }
  }

  private archiveSupport(channel: SlackChannel): ArchiveSupport {
    if (channel.is_im || channel.is_mpim)
      return { mode: 'native', detail: 'Closes the conversation in Slack. Slack reopens it when someone writes.' }
    if (!channel.is_private)
      return { mode: 'native', detail: 'Leaves the channel in Slack, and rejoins it if you unarchive.' }
    return { mode: 'unsupported', detail: 'Leaving a private channel would need someone to invite you back, so it stays in Slack.' }
  }

  private async list(): Promise<SlackChannel[]> {
    const all: SlackChannel[] = []
    let cursor = ''
    do {
      const page = await this.api<{ channels: SlackChannel[], response_metadata?: { next_cursor?: string } }>('users.conversations', { types: CHANNEL_TYPES, exclude_archived: true, limit: 200, ...(cursor ? { cursor } : {}) })
      all.push(...page.channels)
      cursor = page.response_metadata?.next_cursor ?? ''
    } while (cursor)
    return all
  }

  async conversations(): Promise<InboxConversation[]> {
    const me = await this.whoami()
    const channels = await this.list()
    const out: InboxConversation[] = []
    // A few at a time: conversations.info and history are rate-limited per method.
    for (let i = 0; i < channels.length; i += this.concurrency) {
      const batch = channels.slice(i, i + this.concurrency)
      out.push(...await Promise.all(batch.map(channel => this.describe(channel, me))))
    }
    return out.sort((a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0))
  }

  private async describe(listed: SlackChannel, me: { userId: string, team: string, teamId: string }): Promise<InboxConversation> {
    const [{ channel }, history] = await Promise.all([
      this.api<{ channel: SlackChannel }>('conversations.info', { channel: listed.id }).catch(() => ({ channel: listed })),
      this.api<{ messages: SlackMessage[] }>('conversations.history', { channel: listed.id, limit: 1 }).catch(() => ({ messages: [] as SlackMessage[] })),
    ])
    const merged = { ...listed, ...channel }
    this.channels.set(merged.id, merged)
    const latest = history.messages[0]

    let participants: InboxPerson[] = []
    if (merged.is_im)
      participants = [(await this.person(merged.user))!]
    else if (merged.is_mpim) {
      const members = await this.api<{ members: string[] }>('conversations.members', { channel: merged.id, limit: 50 }).catch(() => ({ members: [] as string[] }))
      participants = await Promise.all(members.members.filter(id => id !== me.userId).map(async id => (await this.person(id))!))
    }

    return {
      provider: 'slack',
      id: merged.id,
      kind: merged.is_im ? 'direct' : merged.is_mpim ? 'group' : 'channel',
      title: merged.is_im || merged.is_mpim ? null : `#${merged.name}`,
      participants,
      workspace: me.team,
      lastMessageAt: latest ? tsToMs(latest.ts) : null,
      preview: latest?.text || (latest?.files?.length ? 'Attachment' : null),
      previewFromMe: latest?.user === me.userId,
      unread: merged.unread_count_display ?? 0,
      cursor: latest?.ts ?? '0',
      // A DM Slack has closed is not in the sidebar; channels are while joined.
      visible: merged.is_im || merged.is_mpim ? merged.is_open !== false : true,
      archive: this.archiveSupport(merged),
      url: `slack://channel?team=${me.teamId}&id=${merged.id}`,
    }
  }

  async messages(conversationId: string, query: MessageQuery = {}): Promise<InboxMessage[]> {
    const me = await this.whoami()
    const collected: SlackMessage[] = []
    let cursor = ''
    const limit = query.limit ?? 1000
    do {
      const page = await this.api<{ messages: SlackMessage[], has_more?: boolean, response_metadata?: { next_cursor?: string } }>('conversations.history', {
        channel: conversationId,
        limit: Math.min(200, limit),
        ...(query.after ? { oldest: query.after, inclusive: false } : {}),
        ...(cursor ? { cursor } : {}),
      })
      collected.push(...page.messages)
      cursor = page.has_more ? page.response_metadata?.next_cursor ?? '' : ''
    } while (cursor && collected.length < limit)

    // Slack answers newest first.
    collected.sort((a, b) => Number(a.ts) - Number(b.ts))
    const out: InboxMessage[] = []
    for (const message of collected.slice(-limit)) {
      out.push(await this.toMessage(conversationId, message))
      // Slack keeps reactions on the message; give each its own entry.
      for (const reaction of message.reactions ?? []) {
        for (const user of reaction.users ?? []) {
          out.push({
            id: `${message.ts}:${reaction.name}:${user}`,
            conversationId,
            kind: 'reaction',
            text: null,
            fromMe: user === me.userId,
            sentAt: tsToMs(message.ts),
            sender: user === me.userId ? null : await this.person(user),
            targetId: message.ts,
            reaction: EMOJI[reaction.name] ?? `:${reaction.name}:`,
            reactionRemoved: false,
            replyToId: null,
            editedAt: null,
            unsent: false,
            attachments: [],
            cursor: message.ts,
          })
        }
      }
    }
    return out
  }

  private async toMessage(conversationId: string, message: SlackMessage): Promise<InboxMessage> {
    const me = await this.whoami()
    const sender = await this.person(message.user)
    const event = !!message.subtype && !['file_share', 'thread_broadcast', 'me_message'].includes(message.subtype)
    return {
      id: message.ts,
      conversationId,
      kind: event ? 'event' : 'message',
      text: message.text ?? null,
      fromMe: message.user === me.userId,
      sentAt: tsToMs(message.ts),
      sender: message.user === me.userId ? null : (sender ?? (message.username ? { id: message.bot_id ?? message.username, name: message.username } : null)),
      targetId: null,
      reaction: null,
      reactionRemoved: false,
      replyToId: message.thread_ts && message.thread_ts !== message.ts ? message.thread_ts : null,
      editedAt: message.edited ? tsToMs(message.edited.ts) : null,
      unsent: false,
      attachments: (message.files ?? []).map((file): InboxAttachment => ({
        id: file.id,
        name: file.name ?? file.title ?? file.id,
        mimeType: file.mimetype ?? null,
        bytes: file.size ?? 0,
        path: null,
        url: file.url_private ?? null,
      })),
      cursor: message.ts,
    }
  }

  private async channel(id: string): Promise<SlackChannel> {
    const known = this.channels.get(id)
    if (known)
      return known
    const { channel } = await this.api<{ channel: SlackChannel }>('conversations.info', { channel: id })
    this.channels.set(id, channel)
    return channel
  }

  async archive(conversationId: string): Promise<ArchiveOutcome> {
    const channel = await this.channel(conversationId)
    const support = this.archiveSupport(channel)
    if (support.mode !== 'native')
      return { mode: support.mode, removed: false, detail: support.detail }
    if (channel.is_im || channel.is_mpim)
      await this.api('conversations.close', { channel: conversationId }, true)
    else
      await this.api('conversations.leave', { channel: conversationId }, true)
    this.channels.set(conversationId, { ...channel, is_open: false })
    return { mode: 'native', removed: true, detail: support.detail }
  }

  async unarchive(conversationId: string): Promise<void> {
    const channel = await this.channel(conversationId)
    if (channel.is_im || channel.is_mpim)
      await this.api('conversations.open', { channel: conversationId }, true)
    else if (!channel.is_private)
      await this.api('conversations.join', { channel: conversationId }, true)
    this.channels.set(conversationId, { ...channel, is_open: true })
  }

  /** Slack's file URLs need the token, so they are fetched through here. */
  async attachment(attachment: InboxAttachment): Promise<Response> {
    if (!attachment.url)
      return new Response('Not found', { status: 404 })
    return this.fetch(attachment.url, { headers: { authorization: `Bearer ${this.token}` } })
  }
}
