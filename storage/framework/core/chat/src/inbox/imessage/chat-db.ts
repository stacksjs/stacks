import { Database } from 'bun:sqlite'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { normalizeHandle } from './handles'
import { decodeAttributedBody } from './typedstream'

/**
 * Read-only access to the Messages app's database.
 *
 * `~/Library/Messages/chat.db` is protected by macOS privacy controls (TCC):
 * the process reading it needs Full Disk Access, or every open fails with
 * "authorization denied". Attic never writes to it. Messages' own daemon owns
 * that file, iCloud syncs it, and an edit behind its back is at best ignored
 * until the next launch and at worst synced to every device - which is why
 * archiving is a copy plus Messages' own Delete, never a flag flipped here.
 */

export const DEFAULT_MESSAGES_DB = join(homedir(), 'Library', 'Messages', 'chat.db')

/** Seconds between the Unix epoch and Apple's (2001-01-01T00:00:00Z). */
const APPLE_EPOCH_OFFSET_S = 978_307_200

/** `chat.style` for a one-to-one conversation; 43 is a group. */
export const CHAT_STYLE_DIRECT = 45
export const CHAT_STYLE_GROUP = 43

export function appleDateToUnixMs(date: number | null | undefined): number | null {
  if (!date)
    return null
  // Since High Sierra the column holds nanoseconds; before that, seconds.
  const seconds = date > 1e12 ? date / 1e9 : date
  return Math.round((seconds + APPLE_EPOCH_OFFSET_S) * 1000)
}

/** Apple-epoch nanoseconds, the unit chat.db has used since High Sierra. */
export function unixMsToAppleDate(ms: number): number {
  return Math.round((ms / 1000 - APPLE_EPOCH_OFFSET_S) * 1e9)
}

export interface MessageQuery {
  /** Only messages with a ROWID above this. */
  afterRowId?: number
  /** Only messages sent before this (Unix ms). */
  beforeMs?: number
  limit?: number
  /** Newest first, for showing the end of a transcript. */
  newestFirst?: boolean
  /** ROWID order, for copying in pages. */
  byRowId?: boolean
  /** Also the messages in Recently Deleted: deleted, but not yet purged. */
  includeDeleted?: boolean
}

export class MessagesAccessError extends Error {
  readonly needsFullDiskAccess: boolean

  constructor(public readonly path: string, cause: unknown) {
    const detail = cause instanceof Error ? cause.message : String(cause)
    const denied = /authorization denied|not permitted|unable to open/i.test(detail)
    super(`Cannot read ${path}: ${detail}`)
    this.name = 'MessagesAccessError'
    this.needsFullDiskAccess = denied
  }
}

/** One row of `chat`: Messages' unit of conversation. */
export interface ChatRow {
  rowid: number
  guid: string
  /** Phone number or email for a direct chat, `chat123...` for a group. */
  identifier: string
  style: number
  service: string
  displayName: string | null
  /** Stable across a group's chat rows; what `sms://open?groupid=` takes. */
  groupId: string | null
  participants: string[]
  /** Messages still visible in Messages, i.e. not deleted. */
  messageCount: number
  /** Deleted, but still in Messages' Recently Deleted. */
  recoverableCount: number
  unreadCount: number
  lastMessageAt: number | null
  lastMessageRowId: number
  lastMessageText: string | null
  lastMessageFromMe: boolean
}

export interface AttachmentRow {
  guid: string
  /** Absolute path on this Mac, or null when Messages never downloaded it. */
  path: string | null
  name: string
  mimeType: string | null
  uti: string | null
  bytes: number
  isSticker: boolean
}

export type MessageKind = 'message' | 'reaction' | 'event'

export interface MessageRow {
  rowid: number
  guid: string
  chatGuid: string
  kind: MessageKind
  text: string | null
  isFromMe: boolean
  /** Unix milliseconds. */
  sentAt: number
  /** The other party's handle, normalized. Null for messages you sent. */
  sender: string | null
  service: string
  /** For a reaction: the message it reacts to, and how. */
  targetGuid: string | null
  reactionType: number
  /** For an inline reply: the message it answers. */
  replyToGuid: string | null
  editedAt: number | null
  /** The sender used Undo Send. */
  unsent: boolean
  /** For an event: what happened (renamed, member added, ...). */
  eventType: number
  groupTitle: string | null
  attachments: AttachmentRow[]
}

interface RawMessage {
  rowid: number
  guid: string
  text: string | null
  attributedBody: Uint8Array | null
  is_from_me: number
  date: number
  service: string | null
  associated_message_guid: string | null
  associated_message_type: number | null
  item_type: number | null
  group_title: string | null
  cache_has_attachments: number | null
  reply_to_guid: string | null
  date_edited: number | null
  date_retracted: number | null
  sender: string | null
  chat_guid: string
}

interface RawAttachment {
  message_id: number
  guid: string
  filename: string | null
  transfer_name: string | null
  mime_type: string | null
  uti: string | null
  total_bytes: number | null
  is_sticker: number | null
}

/**
 * The messages a person would see in Messages' list preview and transcript:
 * not reactions, not group events, and something to show.
 */
const isReaction = (type: number): boolean => type >= 2000 && type < 4000

function expandHome(path: string | null): string | null {
  if (!path)
    return null
  return path.startsWith('~/') ? join(homedir(), path.slice(2)) : path
}

/**
 * `associated_message_guid` points at a part of a message, not the message:
 * `p:0/<guid>` for the first part, `bp:<guid>` for a balloon. Reactions are
 * shown on the message, so strip the part.
 */
export function reactionTarget(raw: string | null): string | null {
  if (!raw)
    return null
  const slash = raw.indexOf('/')
  if (slash !== -1)
    return raw.slice(slash + 1)
  return raw.replace(/^bp:/, '')
}

export class MessagesDb {
  private db: Database
  private messageColumns: Set<string>
  private hasRecoverable: boolean

  constructor(public readonly path: string = DEFAULT_MESSAGES_DB) {
    try {
      this.db = new Database(path, { readonly: true })
      // Opening is lazy; touching a table is what actually hits TCC.
      this.db.query('SELECT 1 FROM message LIMIT 1').all()
    }
    catch (error) {
      throw new MessagesAccessError(path, error)
    }
    // chat.db's schema grows with every macOS release (date_edited arrived in
    // Ventura, the Recently Deleted table in Ventura too). Read what is there
    // rather than assume one version.
    this.messageColumns = new Set((this.db.query('PRAGMA table_info(message)').all() as Array<{ name: string }>).map(c => c.name))
    this.hasRecoverable = !!this.db.query(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'chat_recoverable_message_join'`).get()
  }

  close(): void {
    this.db.close()
  }

  latestRowId(): number {
    const row = this.db.query('SELECT MAX(ROWID) AS id FROM message').get() as { id: number | null }
    return row.id ?? 0
  }

  private column(name: string, fallback = 'NULL'): string {
    return this.messageColumns.has(name) ? `m.${name}` : fallback
  }

  /**
   * Every chat Messages knows about, newest activity first, including ones
   * deleted into Recently Deleted (their `messageCount` is 0).
   */
  chats(): ChatRow[] {
    const recoverable = this.hasRecoverable
      ? '(SELECT COUNT(*) FROM chat_recoverable_message_join r WHERE r.chat_id = c.ROWID)'
      : '0'
    const rows = this.db.query(`
      SELECT
        c.ROWID AS rowid, c.guid, c.chat_identifier, c.style, c.service_name, c.display_name, c.group_id,
        (SELECT COUNT(*) FROM chat_message_join j WHERE j.chat_id = c.ROWID) AS message_count,
        ${recoverable} AS recoverable_count,
        (SELECT COUNT(*) FROM chat_message_join j JOIN message m ON m.ROWID = j.message_id
          WHERE j.chat_id = c.ROWID AND m.is_from_me = 0 AND m.is_read = 0 AND m.item_type = 0
            AND (m.associated_message_type IS NULL OR m.associated_message_type = 0)) AS unread_count,
        (SELECT MAX(j.message_id) FROM chat_message_join j WHERE j.chat_id = c.ROWID) AS last_rowid
      FROM chat c
    `).all() as Array<{
      rowid: number
      guid: string
      chat_identifier: string | null
      style: number | null
      service_name: string | null
      display_name: string | null
      group_id: string | null
      message_count: number
      recoverable_count: number
      unread_count: number
      last_rowid: number | null
    }>

    const participants = this.participantsByChat()
    const lastQuery = this.db.query(`SELECT m.text, m.attributedBody, m.date, m.is_from_me FROM message m WHERE m.ROWID = ?`)

    const chats = rows.map((row): ChatRow => {
      const last = row.last_rowid
        ? lastQuery.get(row.last_rowid) as { text: string | null, attributedBody: Uint8Array | null, date: number, is_from_me: number } | null
        : null
      return {
        rowid: row.rowid,
        guid: row.guid,
        identifier: row.chat_identifier ? normalizeHandle(row.chat_identifier) : row.guid,
        style: row.style ?? CHAT_STYLE_DIRECT,
        service: row.service_name ?? 'iMessage',
        displayName: row.display_name?.trim() || null,
        groupId: row.group_id || null,
        participants: participants.get(row.rowid) ?? [],
        messageCount: row.message_count,
        recoverableCount: row.recoverable_count,
        unreadCount: row.unread_count,
        lastMessageAt: last ? appleDateToUnixMs(last.date) : null,
        lastMessageRowId: row.last_rowid ?? 0,
        lastMessageText: last ? (last.text?.trim() ? last.text : decodeAttributedBody(last.attributedBody)) : null,
        lastMessageFromMe: last?.is_from_me === 1,
      }
    })

    return chats.sort((a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0))
  }

  private participantsByChat(): Map<number, string[]> {
    const rows = this.db.query(`
      SELECT chj.chat_id, h.id FROM chat_handle_join chj JOIN handle h ON h.ROWID = chj.handle_id
    `).all() as Array<{ chat_id: number, id: string }>
    const map = new Map<number, string[]>()
    for (const row of rows) {
      const list = map.get(row.chat_id) ?? []
      const handle = normalizeHandle(row.id)
      if (!list.includes(handle))
        list.push(handle)
      map.set(row.chat_id, list)
    }
    return map
  }

  /**
   * The messages of the given chats, oldest first, with ROWID above
   * `afterRowId`. Deleted messages are not included: once Messages has
   * deleted a message, Attic only has what it copied before.
   */
  messages(chatGuids: string[], options: MessageQuery = {}): MessageRow[] {
    if (chatGuids.length === 0)
      return []
    const placeholders = chatGuids.map(() => '?').join(', ')
    // Copying walks ROWID upwards so a page boundary can never skip a row;
    // showing a transcript wants the newest messages by date.
    const order = options.newestFirst ? 'm.date DESC, m.ROWID DESC' : options.byRowId ? 'm.ROWID ASC' : 'm.date ASC, m.ROWID ASC'
    const before = options.beforeMs ? `AND m.date < ${unixMsToAppleDate(options.beforeMs)}` : ''
    // Recently Deleted moves a message from chat_message_join to
    // chat_recoverable_message_join; reading both is how a deleted
    // conversation can still be copied before Messages purges it.
    const joins = options.includeDeleted && this.hasRecoverable
      ? '(SELECT chat_id, message_id FROM chat_message_join UNION SELECT chat_id, message_id FROM chat_recoverable_message_join)'
      : 'chat_message_join'
    const rows = this.db.query(`
      SELECT
        m.ROWID AS rowid, m.guid, m.text, m.attributedBody, m.is_from_me, m.date, m.service,
        m.associated_message_guid, m.associated_message_type, m.item_type, m.group_title,
        m.cache_has_attachments,
        ${this.column('reply_to_guid')} AS reply_to_guid,
        ${this.column('date_edited', '0')} AS date_edited,
        ${this.column('date_retracted', '0')} AS date_retracted,
        h.id AS sender,
        c.guid AS chat_guid
      FROM message m
      JOIN ${joins} cmj ON cmj.message_id = m.ROWID
      JOIN chat c ON c.ROWID = cmj.chat_id
      LEFT JOIN handle h ON h.ROWID = m.handle_id
      WHERE c.guid IN (${placeholders}) AND m.ROWID > ? ${before}
      ORDER BY ${order}
      LIMIT ?
    `).all(...chatGuids, options.afterRowId ?? 0, options.limit ?? 1_000_000) as RawMessage[]

    const attachments = this.attachmentsFor(rows.filter(r => r.cache_has_attachments === 1).map(r => r.rowid))

    return rows.map((row): MessageRow => {
      const associated = row.associated_message_type ?? 0
      const itemType = row.item_type ?? 0
      const kind: MessageKind = isReaction(associated) ? 'reaction' : itemType !== 0 ? 'event' : 'message'
      return {
        rowid: row.rowid,
        guid: row.guid,
        chatGuid: row.chat_guid,
        kind,
        text: row.text?.trim() ? row.text : decodeAttributedBody(row.attributedBody),
        isFromMe: row.is_from_me === 1,
        sentAt: appleDateToUnixMs(row.date) ?? 0,
        sender: row.sender ? normalizeHandle(row.sender) : null,
        service: row.service ?? 'iMessage',
        targetGuid: kind === 'reaction' ? reactionTarget(row.associated_message_guid) : null,
        reactionType: kind === 'reaction' ? associated : 0,
        replyToGuid: row.reply_to_guid || null,
        editedAt: appleDateToUnixMs(row.date_edited),
        unsent: !!row.date_retracted,
        eventType: itemType,
        groupTitle: row.group_title || null,
        attachments: attachments.get(row.rowid) ?? [],
      }
    })
  }

  /** Where Messages keeps one attachment, for showing it before it is copied. */
  attachmentPath(guid: string): { path: string | null, mimeType: string | null, name: string } | null {
    const row = this.db.query('SELECT filename, mime_type, transfer_name FROM attachment WHERE guid = ?').get(guid) as { filename: string | null, mime_type: string | null, transfer_name: string | null } | null
    if (!row)
      return null
    const path = expandHome(row.filename)
    return { path, mimeType: row.mime_type, name: row.transfer_name || (path ? path.split('/').pop()! : guid) }
  }

  private attachmentsFor(messageRowIds: number[]): Map<number, AttachmentRow[]> {
    const map = new Map<number, AttachmentRow[]>()
    // SQLite caps bound parameters; chunk to stay well under it.
    for (let i = 0; i < messageRowIds.length; i += 500) {
      const chunk = messageRowIds.slice(i, i + 500)
      const rows = this.db.query(`
        SELECT maj.message_id, a.guid, a.filename, a.transfer_name, a.mime_type, a.uti, a.total_bytes, a.is_sticker
        FROM message_attachment_join maj JOIN attachment a ON a.ROWID = maj.attachment_id
        WHERE maj.message_id IN (${chunk.map(() => '?').join(', ')})
      `).all(...chunk) as RawAttachment[]
      for (const row of rows) {
        const list = map.get(row.message_id) ?? []
        const path = expandHome(row.filename)
        list.push({
          guid: row.guid,
          path,
          name: row.transfer_name || (path ? path.split('/').pop()! : row.guid),
          mimeType: row.mime_type,
          uti: row.uti,
          bytes: row.total_bytes ?? 0,
          isSticker: row.is_sticker === 1,
        })
        map.set(row.message_id, list)
      }
    }
    return map
  }
}
