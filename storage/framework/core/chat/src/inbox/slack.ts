import type { ArchiveOutcome, ArchiveSupport, Fetch, InboxAttachment, InboxConversation, InboxDriver, InboxMessage, InboxPerson, InboxStatus, MessageQuery } from './types'

export interface SlackInboxConfig {
  /**
   * A user token (`xoxp-…`), so the inbox sees what the person sees. Scopes:
   * `channels:read groups:read im:read mpim:read channels:history
   * groups:history im:history mpim:history users:read im:write mpim:write
   * channels:write` (the last three for archiving).
   */
  token: string
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
  private self: { userId: string, team: string, teamId: string } | null = null
  private users = new Map<string, string | null>()
  private channels = new Map<string, SlackChannel>()

  constructor(config: SlackInboxConfig) {
    this.token = config.token
    this.fetch = config.fetch ?? ((input, init) => fetch(input, init))
    this.apiBase = (config.apiBase ?? 'https://slack.com/api').replace(/\/$/, '')
    this.concurrency = config.concurrency ?? 4
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
        const { user } = await this.api<{ user: { real_name?: string, name?: string, profile?: { display_name?: string, real_name?: string } } }>('users.info', { user: id })
        this.users.set(id, user.profile?.display_name || user.profile?.real_name || user.real_name || user.name || null)
      }
      catch {
        this.users.set(id, null)
      }
    }
    return this.users.get(id) ?? null
  }

  private async person(id: string | undefined): Promise<InboxPerson | null> {
    return id ? { id, name: await this.userName(id) } : null
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
      const sender = await this.person(message.user)
      const event = !!message.subtype && !['file_share', 'thread_broadcast', 'me_message'].includes(message.subtype)
      out.push({
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
      })
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
