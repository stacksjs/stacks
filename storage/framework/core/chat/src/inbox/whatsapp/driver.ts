import type { ArchiveOutcome, ArchiveSupport, InboxAttachment, InboxConversation, InboxDriver, InboxMessage, InboxPerson, InboxStatus, MessageQuery } from '../types'
import type { MessageRow, SessionRow } from './chat-storage'
import { existsSync } from 'node:fs'
import { basename, dirname, extname, join } from 'node:path'
import process from 'node:process'
import { cleanText, DEFAULT_WHATSAPP_DB, DEFAULT_WHATSAPP_MEDIA_ROOT, MessageType, SESSION_DIRECT, WhatsAppAccessError, WhatsAppDb } from './chat-storage'

/**
 * Something that can press WhatsApp's own Archive and Unarchive on one named
 * chat - in Attic, the bundled Swift helper, which finds the chat's row by
 * name in WhatsApp's accessibility tree and invokes that row's own action,
 * never a menu command that applies to whatever happens to be selected.
 */
export interface WhatsAppController {
  archive: (names: string[]) => Promise<{ ok: boolean, detail: string }>
  unarchive: (names: string[]) => Promise<{ ok: boolean, detail: string }>
}

export interface WhatsAppConfig {
  /** Archives and unarchives through WhatsApp itself. Without one, archiving only opens the chat. */
  controller?: WhatsAppController
  /** ChatStorage.sqlite; the signed-in user's by default. */
  databasePath?: string
  /** The directory media paths in the database are relative to. */
  mediaRoot?: string
  /** Opens a URL (a chat in WhatsApp). Defaults to macOS `open`. */
  openUrl?: (url: string) => void
  /** The host OS; `process.platform` by default. This driver reads WhatsApp for Mac. */
  platform?: NodeJS.Platform
  /** How long to wait for WhatsApp to record an archive, in ms. */
  settleMs?: number
}

const ARCHIVE_DETAIL = 'Archives the chat in WhatsApp. WhatsApp brings it back when a new message arrives, unless Keep chats archived is on.'

/** Mime types by message type, for the media rows that do not record one. */
const DEFAULT_MIME: Record<number, string> = {
  [MessageType.Image]: 'image/jpeg',
  [MessageType.Video]: 'video/mp4',
  [MessageType.Audio]: 'audio/ogg',
  [MessageType.Gif]: 'video/mp4',
  [MessageType.Sticker]: 'image/webp',
}

const EXTENSION_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.opus': 'audio/ogg',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.pdf': 'application/pdf',
}

function defaultOpen(url: string): void {
  Bun.spawn(['/usr/bin/open', url], { stdio: ['ignore', 'ignore', 'ignore'] })
}

/** `+1 555…` style for a phone-number JID, the raw id otherwise. */
export function formatJid(jid: string): string {
  const [user = jid, server] = jid.split('@')
  return server === 's.whatsapp.net' && /^\d{7,15}$/.test(user) ? `+${user}` : user
}

/** The `FN:` line of a vCard: the name on a shared contact card. */
function vcardName(vcard: string | null): string | null {
  const match = vcard?.match(/^FN:(.*)$/m)
  return cleanText(match?.[1])
}

/**
 * WhatsApp, read from WhatsApp for Mac's database on this Mac.
 *
 * Reading needs Full Disk Access (WhatsApp's group container is protected App
 * Data) and never writes. WhatsApp has a real Archive of its own, so archiving
 * here is that: with a {@link WhatsAppController} it presses Archive on the
 * chat's row and then waits for WhatsApp to record it, so `removed` is only
 * true once WhatsApp itself says the chat is archived. Unarchive is the
 * reverse. Reactions and quoted replies live in protobuf blobs this driver
 * does not decode, so a transcript has the messages without them.
 */
export class WhatsAppDriver implements InboxDriver {
  readonly provider = 'whatsapp' as const
  readonly label = 'WhatsApp'
  private readonly databasePath: string
  private readonly mediaRoot: string
  private readonly controller: WhatsAppController | undefined
  private readonly openUrl: (url: string) => void
  private readonly platform: NodeJS.Platform
  private readonly settleMs: number

  constructor(config: WhatsAppConfig = {}) {
    this.databasePath = config.databasePath ?? DEFAULT_WHATSAPP_DB
    this.mediaRoot = config.mediaRoot ?? (config.databasePath ? join(dirname(config.databasePath), 'Message') : DEFAULT_WHATSAPP_MEDIA_ROOT)
    this.controller = config.controller
    this.openUrl = config.openUrl ?? defaultOpen
    this.platform = config.platform ?? process.platform
    this.settleMs = config.settleMs ?? 6000
  }

  private open<T>(fn: (db: WhatsAppDb) => T): T {
    const db = new WhatsAppDb(this.databasePath)
    try {
      return fn(db)
    }
    finally {
      db.close()
    }
  }

  async status(): Promise<InboxStatus> {
    if (this.platform !== 'darwin')
      return { connected: false, detail: 'WhatsApp is read from WhatsApp for Mac, so it needs a Mac.', needs: 'unsupported-platform' }
    try {
      this.open(() => undefined)
      return { connected: true, detail: 'Reading WhatsApp on this Mac.' }
    }
    catch (error) {
      if (error instanceof WhatsAppAccessError && error.needsFullDiskAccess && existsSync(dirname(this.databasePath)))
        return { connected: false, detail: 'Grant Full Disk Access in System Settings > Privacy & Security.', needs: 'full-disk-access' }
      return { connected: false, detail: 'Install WhatsApp for Mac and link it to your phone.', needs: 'signed-out' }
    }
  }

  private archiveSupport(session: SessionRow): ArchiveSupport {
    if (this.controller)
      return { mode: 'native', detail: ARCHIVE_DETAIL }
    return this.url(session)
      ? { mode: 'confirm', detail: 'Opens the chat in WhatsApp for you to archive it there.' }
      : { mode: 'unsupported', detail: 'WhatsApp cannot open a group by link, so archive it there yourself.' }
  }

  private url(session: SessionRow): string | null {
    const [user, server] = session.jid.split('@')
    return server === 's.whatsapp.net' && user && /^\d{7,15}$/.test(user) ? `whatsapp://send?phone=${user}` : null
  }

  async conversations(): Promise<InboxConversation[]> {
    return this.open(db => db.sessions().map((s): InboxConversation => {
      const direct = s.type === SESSION_DIRECT
      const participants: InboxPerson[] = direct
        ? [{ id: s.jid, name: s.name }]
        : db.members(s.pk).map(m => ({ id: m.jid, name: m.name }))
      return {
        provider: 'whatsapp',
        id: s.jid,
        kind: direct ? 'direct' : 'group',
        title: direct ? null : s.name,
        participants,
        workspace: null,
        lastMessageAt: s.lastMessageAt,
        preview: s.lastMessageText,
        previewFromMe: s.lastMessageFromMe,
        unread: s.unread,
        cursor: String(s.lastMessagePk),
        visible: !s.archived,
        archive: this.archiveSupport(s),
        url: this.url(s),
      }
    }))
  }

  async messages(conversationId: string, query: MessageQuery = {}): Promise<InboxMessage[]> {
    return this.open((db) => {
      const session = db.session(conversationId)
      if (!session)
        return []
      // Forward from a cursor walks primary keys up; a bare limit wants the
      // newest messages, fetched newest first and turned back around.
      const rows = query.after || !query.limit
        ? db.messages(session.pk, { afterPk: Number(query.after) || 0, limit: query.limit })
        : db.messages(session.pk, { newestFirst: true, limit: query.limit }).reverse()
      return rows.map(row => this.toMessage(session, row))
    })
  }

  private toMessage(session: SessionRow, row: MessageRow): InboxMessage {
    const sender: InboxPerson | null = row.isFromMe
      ? null
      : session.type === SESSION_DIRECT
        ? { id: session.jid, name: session.name }
        : row.senderJid ? { id: row.senderJid, name: row.senderName } : null
    const { kind, text, unsent } = this.describe(row)
    return {
      id: row.stanzaId ?? `wa-${row.pk}`,
      conversationId: session.jid,
      kind,
      text,
      fromMe: row.isFromMe,
      sentAt: row.sentAt,
      sender,
      targetId: null,
      reaction: null,
      reactionRemoved: false,
      replyToId: null,
      editedAt: null,
      unsent,
      attachments: this.attachments(row),
      cursor: String(row.pk),
    }
  }

  /** What a message says, by WhatsApp's message type. */
  private describe(row: MessageRow): { kind: InboxMessage['kind'], text: string | null, unsent: boolean } {
    const media = row.media
    switch (row.type) {
      case MessageType.Text:
      case MessageType.Link:
        return { kind: 'message', text: cleanText(row.text), unsent: false }
      case MessageType.Image:
      case MessageType.Video:
      case MessageType.Gif:
        // A photo or video's caption is the media item's title.
        return { kind: 'message', text: cleanText(row.text) ?? cleanText(media?.title), unsent: false }
      case MessageType.Contact: {
        const name = vcardName(media?.vcard ?? null) ?? cleanText(media?.title)
        return { kind: 'message', text: name ? `Contact card: ${name}` : 'Contact card', unsent: false }
      }
      case MessageType.Location: {
        const place = cleanText(media?.title)
        const link = media?.latitude != null && media.longitude != null && (media.latitude !== 0 || media.longitude !== 0)
          ? `https://maps.apple.com/?ll=${media.latitude},${media.longitude}`
          : null
        return { kind: 'message', text: [place ?? 'Shared a location', link].filter(Boolean).join(' '), unsent: false }
      }
      case MessageType.GroupEvent:
      case MessageType.Call:
        return { kind: 'event', text: cleanText(row.text), unsent: false }
      case MessageType.Deleted:
        return { kind: 'message', text: null, unsent: true }
      case MessageType.Audio:
      case MessageType.Document:
      case MessageType.Sticker:
        return { kind: 'message', text: null, unsent: false }
      default:
        // Polls, pinned-message notices and the like: kept, with whatever
        // text they carry, and marked as events when they carry none.
        return cleanText(row.text) || media?.path
          ? { kind: 'message', text: cleanText(row.text), unsent: false }
          : { kind: 'event', text: null, unsent: false }
    }
  }

  private attachments(row: MessageRow): InboxAttachment[] {
    const media = row.media
    if (!media?.path || row.type === MessageType.Text || row.type === MessageType.Link)
      return []
    const path = join(this.mediaRoot, media.path)
    const recorded = media.vcard && /^[\w.+-]+\/[\w.+-]+/.test(media.vcard) ? media.vcard.split(';')[0]!.trim() : null
    const name = row.type === MessageType.Document
      ? cleanText(media.title) ?? cleanText(row.text) ?? basename(media.path)
      : basename(media.path)
    return [{
      id: `${row.stanzaId ?? `wa-${row.pk}`}:media`,
      name,
      mimeType: recorded ?? EXTENSION_MIME[extname(media.path).toLowerCase()] ?? DEFAULT_MIME[row.type] ?? null,
      bytes: media.bytes,
      path: existsSync(path) ? path : null,
      url: null,
    }]
  }

  /** Every label WhatsApp might give the chat's row. */
  private rowNames(session: SessionRow): string[] {
    return [...new Set([session.name, formatJid(session.jid)].filter((n): n is string => !!n))]
  }

  private async settled(jid: string, archived: boolean): Promise<boolean> {
    const deadline = Date.now() + this.settleMs
    while (true) {
      if (this.open(db => db.session(jid))?.archived === archived)
        return true
      if (Date.now() >= deadline)
        return false
      await Bun.sleep(250)
    }
  }

  async archive(conversationId: string): Promise<ArchiveOutcome> {
    const session = this.open(db => db.session(conversationId))
    if (!session)
      return { mode: 'unsupported', removed: false, detail: 'WhatsApp no longer has this chat.' }
    if (session.archived)
      return { mode: 'native', removed: true, detail: 'Already archived in WhatsApp.' }

    if (this.controller) {
      const result = await this.controller.archive(this.rowNames(session))
      if (!result.ok)
        return { mode: 'native', removed: false, detail: result.detail }
      const removed = await this.settled(conversationId, true)
      return { mode: 'native', removed, detail: removed ? 'Archived in WhatsApp.' : 'WhatsApp did not record the archive.' }
    }

    const url = this.url(session)
    if (url)
      this.openUrl(url)
    return {
      mode: 'confirm',
      removed: false,
      detail: url ? 'WhatsApp is open on the chat: choose Archive chat from its menu to finish.' : 'Archive it in WhatsApp: WhatsApp cannot open a group by link.',
    }
  }

  async unarchive(conversationId: string): Promise<void> {
    if (!this.controller)
      return
    const session = this.open(db => db.session(conversationId))
    if (!session?.archived)
      return
    const result = await this.controller.unarchive(this.rowNames(session))
    if (result.ok)
      await this.settled(conversationId, false)
  }

  async attachment(attachment: InboxAttachment): Promise<Response> {
    if (!attachment.path || !existsSync(attachment.path))
      return new Response('Not found', { status: 404 })
    return new Response(Bun.file(attachment.path), { headers: { 'content-type': attachment.mimeType ?? 'application/octet-stream' } })
  }
}
