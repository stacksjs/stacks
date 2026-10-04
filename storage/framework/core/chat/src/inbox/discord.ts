import type { ArchiveOutcome, ArchiveSupport, Fetch, InboxAttachment, InboxConversation, InboxDriver, InboxMessage, InboxStatus, MessageQuery } from './types'

export interface DiscordInboxConfig {
  /**
   * A bot token. The bot reads the servers it has been added to, with the
   * Read Message History permission (and Manage Threads to archive threads).
   */
  token: string
  /** The person's own Discord user id, so their messages read as "you". */
  userId?: string
  fetch?: Fetch
  apiBase?: string
  concurrency?: number
}

interface DiscordChannel {
  id: string
  type: number
  name?: string
  guild_id?: string
  parent_id?: string | null
  last_message_id?: string | null
  thread_metadata?: { archived: boolean }
}

interface DiscordMessage {
  id: string
  type: number
  content: string
  timestamp: string
  edited_timestamp: string | null
  author: { id: string, username: string, global_name?: string | null, bot?: boolean }
  attachments?: Array<{ id: string, filename: string, content_type?: string, size: number, url: string }>
  reactions?: Array<{ count: number, me?: boolean, emoji: { id: string | null, name: string | null } }>
  message_reference?: { message_id?: string }
}

/** Text, announcement and forum-less thread channel types the inbox reads. */
const TEXT_CHANNELS = new Set([0, 5])
const THREAD_CHANNELS = new Set([10, 11, 12])

/** Discord ids are snowflakes: milliseconds since 2015 in the high bits. */
export function snowflakeTime(id: string | null | undefined): number | null {
  if (!id)
    return null
  return Number((BigInt(id) >> 22n) + 1_420_070_400_000n)
}

/**
 * Discord, through the official API with a bot token.
 *
 * What a bot can see is what Discord allows: the channels and threads of the
 * servers it has been added to. Personal DMs are out of reach - only a user
 * token reads them, and automating a user account breaks Discord's terms and
 * gets accounts banned - so this driver does not offer them.
 *
 * Archiving a thread archives it in Discord, which is Discord's own way of
 * putting one away (it reopens when someone posts). A channel cannot be hidden
 * for one person through the API, so it is archived in the inbox only.
 */
export class DiscordInboxDriver implements InboxDriver {
  readonly provider = 'discord' as const
  readonly label = 'Discord'
  private readonly token: string
  private readonly userId: string | undefined
  private readonly fetch: Fetch
  private readonly apiBase: string
  private readonly concurrency: number
  private guilds = new Map<string, string>()
  private channels = new Map<string, DiscordChannel>()

  constructor(config: DiscordInboxConfig) {
    this.token = config.token
    this.userId = config.userId
    this.fetch = config.fetch ?? ((input, init) => fetch(input, init))
    this.apiBase = (config.apiBase ?? 'https://discord.com/api/v10').replace(/\/$/, '')
    this.concurrency = config.concurrency ?? 3
  }

  private async api<T>(path: string, init: RequestInit = {}): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      const response = await this.fetch(`${this.apiBase}${path}`, {
        ...init,
        headers: { 'authorization': `Bot ${this.token}`, 'content-type': 'application/json', ...(init.headers ?? {}) },
      })
      if (response.status === 429 && attempt < 3) {
        const body = await response.json().catch(() => ({})) as { retry_after?: number }
        await Bun.sleep(Math.min(30, body.retry_after ?? 1) * 1000)
        continue
      }
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { message?: string }
        throw new Error(`Discord ${init.method ?? 'GET'} ${path} failed: ${body.message ?? response.status}`)
      }
      return (response.status === 204 ? undefined : await response.json()) as T
    }
  }

  async status(): Promise<InboxStatus> {
    if (!this.token)
      return { connected: false, detail: 'Add a Discord bot token.', needs: 'token' }
    try {
      const me = await this.api<{ username: string }>('/users/@me')
      return { connected: true, detail: `Reading the servers ${me.username} is in.` }
    }
    catch (error) {
      return { connected: false, detail: error instanceof Error ? error.message : String(error), needs: 'token' }
    }
  }

  private archiveSupport(channel: DiscordChannel): ArchiveSupport {
    if (THREAD_CHANNELS.has(channel.type))
      return { mode: 'native', detail: 'Archives the thread in Discord. It reopens when someone posts.' }
    return { mode: 'unsupported', detail: 'Discord cannot hide a channel for one person, so it stays in Discord.' }
  }

  async conversations(): Promise<InboxConversation[]> {
    const guilds = await this.api<Array<{ id: string, name: string }>>('/users/@me/guilds')
    const channels: DiscordChannel[] = []
    for (const guild of guilds) {
      this.guilds.set(guild.id, guild.name)
      const [all, active] = await Promise.all([
        this.api<DiscordChannel[]>(`/guilds/${guild.id}/channels`).catch(() => [] as DiscordChannel[]),
        this.api<{ threads: DiscordChannel[] }>(`/guilds/${guild.id}/threads/active`).catch(() => ({ threads: [] as DiscordChannel[] })),
      ])
      channels.push(...all.filter(c => TEXT_CHANNELS.has(c.type)).map(c => ({ ...c, guild_id: guild.id })))
      channels.push(...active.threads.map(t => ({ ...t, guild_id: t.guild_id ?? guild.id })))
    }

    const out: InboxConversation[] = []
    for (let i = 0; i < channels.length; i += this.concurrency) {
      const batch = channels.slice(i, i + this.concurrency)
      out.push(...await Promise.all(batch.map(channel => this.describe(channel))))
    }
    return out.sort((a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0))
  }

  private async describe(channel: DiscordChannel): Promise<InboxConversation> {
    this.channels.set(channel.id, channel)
    const latest = channel.last_message_id
      ? (await this.api<DiscordMessage[]>(`/channels/${channel.id}/messages?limit=1`).catch(() => [] as DiscordMessage[]))[0]
      : undefined
    const thread = THREAD_CHANNELS.has(channel.type)
    return {
      provider: 'discord',
      id: channel.id,
      kind: thread ? 'thread' : 'channel',
      title: thread ? channel.name ?? 'Thread' : `#${channel.name}`,
      participants: [],
      workspace: channel.guild_id ? this.guilds.get(channel.guild_id) ?? null : null,
      lastMessageAt: latest ? Date.parse(latest.timestamp) : snowflakeTime(channel.last_message_id),
      preview: latest ? (latest.content || (latest.attachments?.length ? 'Attachment' : null)) : null,
      previewFromMe: !!latest && latest.author.id === this.userId,
      unread: 0,
      cursor: channel.last_message_id ?? '0',
      visible: !channel.thread_metadata?.archived,
      archive: this.archiveSupport(channel),
      url: `https://discord.com/channels/${channel.guild_id ?? '@me'}/${channel.id}`,
    }
  }

  async messages(conversationId: string, query: MessageQuery = {}): Promise<InboxMessage[]> {
    const limit = query.limit ?? 1000
    const collected: DiscordMessage[] = []
    const byId = (a: DiscordMessage, b: DiscordMessage) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1)
    if (query.after) {
      // Forward from the cursor: `after` pages from the oldest.
      let after = query.after
      while (collected.length < limit) {
        const page = await this.api<DiscordMessage[]>(`/channels/${conversationId}/messages?limit=100&after=${after}`)
        if (page.length === 0)
          break
        page.sort(byId)
        collected.push(...page)
        after = page[page.length - 1]!.id
        if (page.length < 100)
          break
      }
    }
    else {
      // The most recent: no cursor reads newest first, paging back with `before`.
      let before = ''
      while (collected.length < limit) {
        const page = await this.api<DiscordMessage[]>(`/channels/${conversationId}/messages?limit=${Math.min(100, limit - collected.length)}${before ? `&before=${before}` : ''}`)
        if (page.length === 0)
          break
        page.sort(byId)
        collected.unshift(...page)
        before = page[0]!.id
        if (page.length < 100)
          break
      }
    }

    const out: InboxMessage[] = []
    for (const message of collected.slice(0, limit)) {
      const mine = message.author.id === this.userId
      out.push({
        id: message.id,
        conversationId,
        // 0 default, 19 reply, 20 slash command; everything else is a system event.
        kind: [0, 19, 20, 21].includes(message.type) ? 'message' : 'event',
        text: message.content || null,
        fromMe: mine,
        sentAt: Date.parse(message.timestamp),
        sender: mine ? null : { id: message.author.id, name: message.author.global_name || message.author.username },
        targetId: null,
        reaction: null,
        reactionRemoved: false,
        replyToId: message.message_reference?.message_id ?? null,
        editedAt: message.edited_timestamp ? Date.parse(message.edited_timestamp) : null,
        unsent: false,
        attachments: (message.attachments ?? []).map((a): InboxAttachment => ({
          id: a.id,
          name: a.filename,
          mimeType: a.content_type ?? null,
          bytes: a.size,
          path: null,
          url: a.url,
        })),
        cursor: message.id,
      })
      // Discord reports reactions as counts, not people.
      for (const reaction of message.reactions ?? []) {
        out.push({
          id: `${message.id}:${reaction.emoji.id ?? reaction.emoji.name}`,
          conversationId,
          kind: 'reaction',
          text: reaction.count > 1 ? String(reaction.count) : null,
          fromMe: !!reaction.me,
          sentAt: Date.parse(message.timestamp),
          sender: null,
          targetId: message.id,
          reaction: reaction.emoji.name ?? '•',
          reactionRemoved: false,
          replyToId: null,
          editedAt: null,
          unsent: false,
          attachments: [],
          cursor: message.id,
        })
      }
    }
    return out
  }

  private async channel(id: string): Promise<DiscordChannel> {
    const known = this.channels.get(id)
    if (known)
      return known
    const channel = await this.api<DiscordChannel>(`/channels/${id}`)
    this.channels.set(id, channel)
    return channel
  }

  async archive(conversationId: string): Promise<ArchiveOutcome> {
    const channel = await this.channel(conversationId)
    const support = this.archiveSupport(channel)
    if (support.mode !== 'native')
      return { mode: support.mode, removed: false, detail: support.detail }
    await this.api(`/channels/${conversationId}`, { method: 'PATCH', body: JSON.stringify({ archived: true }) })
    this.channels.set(conversationId, { ...channel, thread_metadata: { archived: true } })
    return { mode: 'native', removed: true, detail: support.detail }
  }

  async unarchive(conversationId: string): Promise<void> {
    const channel = await this.channel(conversationId)
    if (!THREAD_CHANNELS.has(channel.type))
      return
    await this.api(`/channels/${conversationId}`, { method: 'PATCH', body: JSON.stringify({ archived: false }) })
    this.channels.set(conversationId, { ...channel, thread_metadata: { archived: false } })
  }

  /** Discord's attachment URLs are signed CDN links and need no token. */
  async attachment(attachment: InboxAttachment): Promise<Response> {
    return attachment.url ? this.fetch(attachment.url) : new Response('Not found', { status: 404 })
  }
}
