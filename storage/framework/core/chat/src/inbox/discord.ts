import type { ArchiveOutcome, ArchiveSupport, Fetch, InboxAttachment, InboxCapabilities, InboxConversation, InboxDriver, InboxEvent, InboxMessage, InboxStatus, MessageQuery, OutgoingMessage, SendOutcome } from './types'
import { DiscordGateway } from './discord-gateway'
import { canRead, channelPermissions } from './discord-permissions'
import { onHost } from './image'

export interface DiscordInboxConfig {
  /**
   * A bot token, or with `account: 'user'` the person's own token.
   *
   * A bot reads the servers it has been added to. A user token is the
   * person's whole Discord - DMs, group DMs and their servers - and is how
   * the official client signs in; automating one is against Discord's terms,
   * so it is the person's own choice to make.
   */
  token: string
  /** `bot` (the default) or `user`. */
  account?: 'bot' | 'user'
  /** The person's own Discord user id, so their messages read as "you" (bots; users learn it). */
  userId?: string
  fetch?: Fetch
  apiBase?: string
  concurrency?: number
  /** The WebSocket constructor for the gateway; the global one by default. */
  WebSocket?: new (url: string) => WebSocket
  /** The gateway URL, for tests. */
  gatewayUrl?: string
}

interface DiscordUser { id: string, username: string, global_name?: string | null, avatar?: string | null, bot?: boolean }

interface DiscordChannel {
  id: string
  type: number
  name?: string | null
  icon?: string | null
  guild_id?: string
  parent_id?: string | null
  last_message_id?: string | null
  thread_metadata?: { archived: boolean }
  recipients?: DiscordUser[]
  recipient_ids?: string[]
  permission_overwrites?: Array<{ id: string, type: number | string, allow: string, deny: string }>
}

interface DiscordMessage {
  id: string
  channel_id?: string
  type: number
  content: string
  timestamp: string
  edited_timestamp: string | null
  author: DiscordUser
  attachments?: Array<{ id: string, filename: string, content_type?: string, size: number, url: string }>
  reactions?: Array<{ count: number, me?: boolean, emoji: { id: string | null, name: string | null } }>
  message_reference?: { message_id?: string }
}

interface ReadState { id: string, last_message_id?: string | null, mention_count?: number }

/** Text and announcement channels, threads, and the two kinds of DM. */
const TEXT_CHANNELS = new Set([0, 5])
const THREAD_CHANNELS = new Set([10, 11, 12])
const DM = 1
const GROUP_DM = 3

/** How the desktop client describes itself; a user session sends the same. */
const CLIENT_PROPERTIES = {
  os: 'Mac OS X',
  browser: 'Discord Client',
  release_channel: 'stable',
  client_version: '0.0.360',
  os_version: '25.0.0',
  os_arch: 'arm64',
  app_arch: 'arm64',
  system_locale: 'en-US',
  browser_user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) discord/0.0.360 Chrome/134.0.6998.205 Electron/35.3.0 Safari/537.36',
  browser_version: '35.3.0',
  client_build_number: 420_000,
  native_build_number: null,
  client_event_source: null,
}

/** Discord ids are snowflakes: milliseconds since 2015 in the high bits. */
export function snowflakeTime(id: string | null | undefined): number | null {
  if (!id)
    return null
  return Number((BigInt(id) >> 22n) + 1_420_070_400_000n)
}

const later = (a: string | null | undefined, b: string | null | undefined): boolean => !!a && (!b || BigInt(a) > BigInt(b))
const avatarUrl = (user: DiscordUser): string | null => user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128` : null
const nameOf = (user: DiscordUser): string => user.global_name || user.username

/**
 * Discord, through the official API.
 *
 * With a bot token it reads the channels and threads of the servers the bot
 * is in. With the person's own token (`account: 'user'`) it is their client:
 * DMs, group DMs, and the server channels they can read, listed from the
 * gateway's READY and kept current by its events, with sending, reactions and
 * read state through the API.
 *
 * Archiving a DM closes it, as the client's own Close DM does, and it comes
 * back when someone writes. A group DM can only be left, which loses it, so
 * like a server channel it is archived in the inbox alone. A bot archives a
 * thread in Discord.
 */
export class DiscordInboxDriver implements InboxDriver {
  readonly provider = 'discord' as const
  readonly label = 'Discord'
  private readonly token: string
  private readonly account: 'bot' | 'user'
  private userId: string | undefined
  private readonly fetch: Fetch
  private readonly apiBase: string
  private readonly concurrency: number
  private readonly Socket: (new (url: string) => WebSocket) | undefined
  private readonly gatewayUrl: string | undefined
  private session: DiscordGateway | null = null
  private listeners = new Set<(event: InboxEvent) => void>()
  private guilds = new Map<string, string>()
  private icons = new Map<string, string | null>()
  private channels = new Map<string, DiscordChannel>()
  private users = new Map<string, DiscordUser>()
  private readStates = new Map<string, ReadState>()
  private muted = new Set<string>()
  /** Channels the inbox lists, so a server's other traffic is not reported. */
  private listed = new Set<string>()

  constructor(config: DiscordInboxConfig) {
    this.token = config.token
    this.account = config.account ?? 'bot'
    this.userId = config.userId
    this.fetch = config.fetch ?? ((input, init) => fetch(input, init))
    this.apiBase = (config.apiBase ?? (this.account === 'user' ? 'https://discord.com/api/v9' : 'https://discord.com/api/v10')).replace(/\/$/, '')
    this.concurrency = config.concurrency ?? 3
    this.Socket = config.WebSocket ?? (globalThis as { WebSocket?: new (url: string) => WebSocket }).WebSocket
    this.gatewayUrl = config.gatewayUrl
  }

  private get isUser(): boolean {
    return this.account === 'user'
  }

  private headers(): Record<string, string> {
    if (!this.isUser)
      return { authorization: `Bot ${this.token}` }
    return {
      'authorization': this.token,
      'user-agent': CLIENT_PROPERTIES.browser_user_agent,
      'x-super-properties': btoa(JSON.stringify(CLIENT_PROPERTIES)),
      'x-discord-locale': 'en-US',
    }
  }

  private async api<T>(path: string, init: RequestInit = {}): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      const json = typeof init.body === 'string'
      const response = await this.fetch(`${this.apiBase}${path}`, {
        ...init,
        headers: { ...this.headers(), ...(json ? { 'content-type': 'application/json' } : {}), ...(init.headers ?? {}) },
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

  capabilities(): InboxCapabilities {
    return { send: true, attachments: true, replies: true, reactions: true, markRead: this.isUser, live: this.isUser }
  }

  async status(): Promise<InboxStatus> {
    if (!this.token)
      return { connected: false, detail: this.isUser ? 'Sign in with your Discord token.' : 'Add a Discord bot token.', needs: 'token' }
    try {
      const me = await this.api<DiscordUser>('/users/@me')
      this.userId ??= me.id
      return { connected: true, detail: this.isUser ? `Signed in as ${nameOf(me)}.` : `Reading the servers ${me.username} is in.` }
    }
    catch (error) {
      return { connected: false, detail: error instanceof Error ? error.message : String(error), needs: 'token' }
    }
  }

  // ── The user's gateway session ──────────────────────────────────────

  private gateway(): DiscordGateway {
    if (!this.session) {
      if (!this.Socket)
        throw new Error('No WebSocket to reach Discord with.')
      this.session = new DiscordGateway(
        { token: this.token, properties: CLIENT_PROPERTIES, capabilities: 0 },
        {
          url: this.gatewayUrl,
          WebSocket: this.Socket,
          onDispatch: (type, data) => this.onDispatch(type, data),
          onAuthFailed: reason => this.emit({ type: 'changed', conversationId: null }, reason),
        },
      )
    }
    return this.session
  }

  private emit(event: InboxEvent, _reason?: string): void {
    for (const listener of this.listeners)
      listener(event)
  }

  /** Take in READY: who the person is, their DMs, servers, read states and mutes. */
  private absorbReady(ready: any): void {
    if (ready.user) {
      this.userId = ready.user.id
      this.users.set(ready.user.id, ready.user)
    }
    for (const user of ready.users ?? [])
      this.users.set(user.id, user)
    for (const channel of ready.private_channels ?? []) {
      for (const user of channel.recipients ?? [])
        this.users.set(user.id, user)
      this.channels.set(channel.id, channel)
    }
    const states: ReadState[] = Array.isArray(ready.read_state) ? ready.read_state : (ready.read_state?.entries ?? [])
    for (const state of states)
      this.readStates.set(state.id, state)
    const settings: any[] = Array.isArray(ready.user_guild_settings) ? ready.user_guild_settings : (ready.user_guild_settings?.entries ?? [])
    for (const entry of settings) {
      if (entry.muted && entry.guild_id)
        this.muted.add(entry.guild_id)
      for (const override of entry.channel_overrides ?? []) {
        if (override.muted)
          this.muted.add(override.channel_id)
      }
    }
    const guilds: any[] = ready.guilds ?? []
    guilds.forEach((guild, index) => {
      const name = guild.properties?.name ?? guild.name ?? 'Server'
      const icon = guild.properties?.icon ?? guild.icon ?? null
      this.guilds.set(guild.id, name)
      this.icons.set(guild.id, icon ? `https://cdn.discordapp.com/icons/${guild.id}/${icon}.png?size=128` : null)
      const memberRoles: string[] | null = ready.merged_members?.[index]?.[0]?.roles
        ?? guild.members?.find((m: any) => m.user?.id === this.userId)?.roles
        ?? null
      const ownerId = guild.properties?.owner_id ?? guild.owner_id ?? null
      for (const channel of [...(guild.channels ?? []), ...(guild.threads ?? [])] as DiscordChannel[]) {
        if (!TEXT_CHANNELS.has(channel.type) && !THREAD_CHANNELS.has(channel.type))
          continue
        const withGuild = { ...channel, guild_id: guild.id }
        // Readable by the person, where their roles are known; a channel they
        // have opened (it has a read state) is readable whatever.
        const readable = this.readStates.has(channel.id) || (memberRoles !== null && canRead(channelPermissions({
          guildId: guild.id,
          ownerId,
          userId: this.userId ?? '',
          memberRoles,
          roles: guild.roles ?? [],
          overwrites: (THREAD_CHANNELS.has(channel.type) ? (guild.channels ?? []).find((c: DiscordChannel) => c.id === channel.parent_id)?.permission_overwrites : channel.permission_overwrites) ?? [],
        })))
        if (readable)
          this.channels.set(channel.id, withGuild)
      }
    })
  }

  private onDispatch(type: string, data: any): void {
    switch (type) {
      case 'READY':
        this.absorbReady(data)
        this.emit({ type: 'changed', conversationId: null })
        break
      case 'MESSAGE_CREATE': {
        const channel = this.channels.get(data.channel_id)
        if (channel)
          this.channels.set(data.channel_id, { ...channel, last_message_id: data.id })
        if (data.author)
          this.users.set(data.author.id, data.author)
        // Conversations the inbox lists, a DM (a new one has no server), and
        // anything that mentions the person - not every server's traffic.
        const mentionsMe = (data.mentions ?? []).some((user: DiscordUser) => user.id === this.userId)
        if (this.listed.has(data.channel_id) || channel?.type === DM || channel?.type === GROUP_DM || (!channel && !data.guild_id) || mentionsMe)
          this.emit({ type: 'message', conversationId: data.channel_id, message: this.toMessage(data.channel_id, data)[0]! })
        break
      }
      case 'MESSAGE_ACK':
        this.readStates.set(data.channel_id, { id: data.channel_id, last_message_id: data.message_id, mention_count: data.mention_count ?? 0 })
        this.emit({ type: 'changed', conversationId: data.channel_id })
        break
      case 'CHANNEL_CREATE':
        if (data.type === DM || data.type === GROUP_DM) {
          for (const user of data.recipients ?? [])
            this.users.set(user.id, user)
          this.channels.set(data.id, data)
          this.emit({ type: 'changed', conversationId: data.id })
        }
        break
      case 'CHANNEL_DELETE':
        if (data.type === DM || data.type === GROUP_DM)
          this.channels.delete(data.id)
        this.emit({ type: 'changed', conversationId: data.id })
        break
      case 'MESSAGE_UPDATE':
      case 'MESSAGE_DELETE':
      case 'MESSAGE_REACTION_ADD':
      case 'MESSAGE_REACTION_REMOVE':
        if (this.listed.has(data.channel_id) || this.channels.get(data.channel_id)?.type === DM || this.channels.get(data.channel_id)?.type === GROUP_DM)
          this.emit({ type: 'changed', conversationId: data.channel_id })
        break
    }
  }

  watch(onEvent: (event: InboxEvent) => void): () => void {
    if (!this.isUser)
      return () => {}
    this.listeners.add(onEvent)
    void this.gateway().whenReady().catch(() => {})
    return () => {
      this.listeners.delete(onEvent)
    }
  }

  /** Close the gateway session. */
  close(): void {
    this.session?.stop()
    this.session = null
  }

  // ── Listing ─────────────────────────────────────────────────────────

  private archiveSupport(channel: DiscordChannel): ArchiveSupport {
    if (channel.type === DM)
      return { mode: 'native', detail: 'Closes the DM in Discord. It comes back when they write.' }
    if (channel.type === GROUP_DM)
      return { mode: 'unsupported', detail: 'Discord can only leave a group DM, which loses it, so it stays in Discord.' }
    if (THREAD_CHANNELS.has(channel.type) && !this.isUser)
      return { mode: 'native', detail: 'Archives the thread in Discord. It reopens when someone posts.' }
    return { mode: 'unsupported', detail: 'Discord cannot hide a channel for one person, so it stays in Discord.' }
  }

  async conversations(): Promise<InboxConversation[]> {
    if (this.isUser)
      return this.userConversations()

    const guilds = await this.api<Array<{ id: string, name: string, icon?: string | null }>>('/users/@me/guilds')
    const channels: DiscordChannel[] = []
    for (const guild of guilds) {
      this.guilds.set(guild.id, guild.name)
      this.icons.set(guild.id, guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128` : null)
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
      out.push(...await Promise.all(batch.map(channel => this.describe(channel, true))))
    }
    return out.sort((a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0))
  }

  /**
   * DMs and group DMs, and the server channels the person has opened or can
   * read: from READY, newest first. Previews are fetched for the most recent
   * DMs only, to stay within the pace a person's client keeps.
   */
  private async userConversations(): Promise<InboxConversation[]> {
    if (!this.session?.ready)
      this.absorbReady(await this.gateway().whenReady())
    const all = [...this.channels.values()]
      .filter(c => c.type === DM || c.type === GROUP_DM || this.readStates.has(c.id))
      .sort((a, b) => (later(a.last_message_id, b.last_message_id) ? -1 : 1))
    const previewed = new Set(all.filter(c => c.type === DM || c.type === GROUP_DM).slice(0, 40).map(c => c.id))
    const out: InboxConversation[] = []
    for (let i = 0; i < all.length; i += this.concurrency) {
      const batch = all.slice(i, i + this.concurrency)
      out.push(...await Promise.all(batch.map(channel => this.describe(channel, previewed.has(channel.id)))))
    }
    this.listed = new Set(out.map(c => c.id))
    return out
  }

  private recipients(channel: DiscordChannel): DiscordUser[] {
    if (channel.recipients?.length)
      return channel.recipients
    return (channel.recipient_ids ?? []).map(id => this.users.get(id)).filter((u): u is DiscordUser => !!u)
  }

  private async describe(channel: DiscordChannel, withPreview: boolean): Promise<InboxConversation> {
    this.channels.set(channel.id, channel)
    const latest = withPreview && channel.last_message_id
      ? (await this.api<DiscordMessage[]>(`/channels/${channel.id}/messages?limit=1`).catch(() => [] as DiscordMessage[]))[0]
      : undefined
    const thread = THREAD_CHANNELS.has(channel.type)
    const isDm = channel.type === DM || channel.type === GROUP_DM
    const people = isDm ? this.recipients(channel) : []
    const title = channel.type === DM
      ? (people[0] ? nameOf(people[0]) : 'Direct message')
      : channel.type === GROUP_DM
        ? (channel.name || people.map(nameOf).join(', ') || 'Group')
        : thread ? channel.name ?? 'Thread' : `#${channel.name}`
    const state = this.readStates.get(channel.id)
    const muted = this.muted.has(channel.id) || (!!channel.guild_id && this.muted.has(channel.guild_id))
    const unreadMessages = this.isUser && later(channel.last_message_id, state?.last_message_id ?? (isDm ? null : channel.last_message_id))
    const unread = !this.isUser ? 0 : (state?.mention_count || (unreadMessages && (isDm || !muted) ? 1 : 0))
    const avatar = channel.type === DM
      ? (people[0] ? avatarUrl(people[0]) : null)
      : channel.type === GROUP_DM
        ? (channel.icon ? `https://cdn.discordapp.com/channel-icons/${channel.id}/${channel.icon}.png?size=128` : null)
        : channel.guild_id ? this.icons.get(channel.guild_id) ?? null : null
    return {
      provider: 'discord',
      id: channel.id,
      kind: channel.type === DM ? 'direct' : channel.type === GROUP_DM ? 'group' : thread ? 'thread' : 'channel',
      title,
      participants: people.map(p => ({ id: p.id, name: nameOf(p), avatar: avatarUrl(p) })),
      workspace: channel.guild_id ? this.guilds.get(channel.guild_id) ?? null : null,
      avatar,
      lastMessageAt: latest ? Date.parse(latest.timestamp) : snowflakeTime(channel.last_message_id),
      preview: latest ? (latest.content || (latest.attachments?.length ? 'Attachment' : null)) : null,
      previewFromMe: !!latest && latest.author.id === this.userId,
      unread,
      cursor: channel.last_message_id ?? '0',
      visible: !channel.thread_metadata?.archived,
      archive: this.archiveSupport(channel),
      url: `https://discord.com/channels/${channel.guild_id ?? '@me'}/${channel.id}`,
    }
  }

  // ── Reading ─────────────────────────────────────────────────────────

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
    return collected.slice(0, limit).flatMap(message => this.toMessage(conversationId, message))
  }

  /** A message and, after it, an entry for each of its reactions. */
  private toMessage(conversationId: string, message: DiscordMessage): InboxMessage[] {
    const mine = message.author.id === this.userId
    const out: InboxMessage[] = [{
      id: message.id,
      conversationId,
      // 0 default, 19 reply, 20 slash command; everything else is a system event.
      kind: [0, 19, 20, 21].includes(message.type) ? 'message' : 'event',
      text: message.content || null,
      fromMe: mine,
      sentAt: Date.parse(message.timestamp),
      sender: mine ? null : { id: message.author.id, name: nameOf(message.author), avatar: avatarUrl(message.author) },
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
    }]
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
    return out
  }

  // ── Writing ─────────────────────────────────────────────────────────

  async send(conversationId: string, message: OutgoingMessage): Promise<SendOutcome> {
    const text = message.text?.trim() ?? ''
    const files = message.files ?? []
    if (!text && files.length === 0)
      throw new Error('Nothing to send.')
    // A nonce as the client makes one, so a retried request is not posted twice.
    const nonce = String((BigInt(Date.now()) - 1_420_070_400_000n) << 22n)
    const payload: Record<string, unknown> = { content: text, nonce, tts: false }
    if (message.replyToId)
      payload.message_reference = { message_id: message.replyToId, channel_id: conversationId }
    let sent: DiscordMessage
    if (files.length === 0) {
      sent = await this.api<DiscordMessage>(`/channels/${conversationId}/messages`, { method: 'POST', body: JSON.stringify(payload) })
    }
    else {
      const form = new FormData()
      payload.attachments = files.map((file, i) => ({ id: i, filename: file.name ?? file.path.split('/').pop() }))
      form.append('payload_json', JSON.stringify(payload))
      for (const [i, file] of files.entries())
        form.append(`files[${i}]`, Bun.file(file.path), file.name ?? file.path.split('/').pop())
      sent = await this.api<DiscordMessage>(`/channels/${conversationId}/messages`, { method: 'POST', body: form })
    }
    const channel = this.channels.get(conversationId)
    if (channel)
      this.channels.set(conversationId, { ...channel, last_message_id: sent.id })
    return { id: sent.id, sentAt: Date.parse(sent.timestamp) || Date.now() }
  }

  async react(conversationId: string, messageId: string, reaction: string, remove = false): Promise<void> {
    // Reactions are listed as `<message>:<emoji>`; the message is the first part.
    const target = messageId.split(':')[0]!
    await this.api(`/channels/${conversationId}/messages/${target}/reactions/${encodeURIComponent(reaction)}/@me`, { method: remove ? 'DELETE' : 'PUT' })
  }

  async markRead(conversationId: string): Promise<void> {
    if (!this.isUser)
      return
    let last = this.channels.get(conversationId)?.last_message_id
    if (!last)
      last = (await this.api<DiscordMessage[]>(`/channels/${conversationId}/messages?limit=1`))[0]?.id
    if (!last)
      return
    await this.api(`/channels/${conversationId}/messages/${last}/ack`, { method: 'POST', body: JSON.stringify({ token: null }) })
    this.readStates.set(conversationId, { id: conversationId, last_message_id: last, mention_count: 0 })
  }

  // ── Archiving ───────────────────────────────────────────────────────

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
    if (channel.type === DM) {
      // Closing a DM is DELETE on the channel, as the client's Close DM.
      await this.api(`/channels/${conversationId}`, { method: 'DELETE' })
      return { mode: 'native', removed: true, detail: support.detail }
    }
    await this.api(`/channels/${conversationId}`, { method: 'PATCH', body: JSON.stringify({ archived: true }) })
    this.channels.set(conversationId, { ...channel, thread_metadata: { archived: true } })
    return { mode: 'native', removed: true, detail: support.detail }
  }

  async unarchive(conversationId: string): Promise<void> {
    const channel = await this.channel(conversationId)
    if (channel.type === DM) {
      const recipient = this.recipients(channel)[0]
      if (recipient)
        await this.api('/users/@me/channels', { method: 'POST', body: JSON.stringify({ recipients: [recipient.id] }) })
      return
    }
    if (!THREAD_CHANNELS.has(channel.type))
      return
    await this.api(`/channels/${conversationId}`, { method: 'PATCH', body: JSON.stringify({ archived: false }) })
    this.channels.set(conversationId, { ...channel, thread_metadata: { archived: false } })
  }

  /** A user avatar, group or server icon: a Discord CDN URL, fetched only from there. */
  async avatar(ref: string): Promise<Response> {
    if (!onHost(ref, ['cdn.discordapp.com']))
      return new Response('Not found', { status: 404 })
    return this.fetch(ref)
  }

  /** Discord's attachment URLs are signed CDN links and need no token. */
  async attachment(attachment: InboxAttachment): Promise<Response> {
    return attachment.url ? this.fetch(attachment.url) : new Response('Not found', { status: 404 })
  }
}
