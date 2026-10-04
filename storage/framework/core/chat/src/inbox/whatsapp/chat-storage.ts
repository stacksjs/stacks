import { Database } from 'bun:sqlite'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { appleDateToUnixMs } from '../imessage/chat-db'

/**
 * Read-only access to WhatsApp's database on a Mac.
 *
 * WhatsApp for Mac keeps every chat in `ChatStorage.sqlite`, a Core Data
 * store in its group container - the same layout as WhatsApp on iPhone. The
 * container sits behind macOS' App Data protection, so the reading process
 * needs Full Disk Access. Nothing here writes to it: WhatsApp owns the file,
 * syncs it with the phone, and an edit behind its back would at best be
 * overwritten. Archiving goes through WhatsApp's own Archive instead, and this
 * reader only confirms it landed (`ZARCHIVED`).
 */

export const DEFAULT_WHATSAPP_CONTAINER = join(homedir(), 'Library', 'Group Containers', 'group.net.whatsapp.WhatsApp.shared')
export const DEFAULT_WHATSAPP_DB = join(DEFAULT_WHATSAPP_CONTAINER, 'ChatStorage.sqlite')
/** Media paths in the database are relative to this. */
export const DEFAULT_WHATSAPP_MEDIA_ROOT = join(DEFAULT_WHATSAPP_CONTAINER, 'Message')

/** `ZWACHATSESSION.ZSESSIONTYPE`. Broadcast lists (2) and status updates (3) are not conversations. */
export const SESSION_DIRECT = 0
export const SESSION_GROUP = 1
/** A community's announcement group. */
export const SESSION_COMMUNITY = 4

/** `ZWAMESSAGE.ZMESSAGETYPE` values with a known meaning. */
export const MessageType = {
  Text: 0,
  Image: 1,
  Video: 2,
  Audio: 3,
  Contact: 4,
  Location: 5,
  GroupEvent: 6,
  Link: 7,
  Document: 8,
  Call: 10,
  Gif: 11,
  Deleted: 14,
  Sticker: 15,
} as const

export class WhatsAppAccessError extends Error {
  readonly needsFullDiskAccess: boolean

  constructor(public readonly path: string, cause: unknown) {
    const detail = cause instanceof Error ? cause.message : String(cause)
    super(`Cannot read ${path}: ${detail}`)
    this.name = 'WhatsAppAccessError'
    this.needsFullDiskAccess = /authorization denied|not permitted|unable to open/i.test(detail)
  }
}

export interface SessionRow {
  pk: number
  /** `15551234567@s.whatsapp.net`, `…@lid`, or `…@g.us` for a group. */
  jid: string
  type: number
  /** The contact's or group's name as WhatsApp shows it. */
  name: string | null
  archived: boolean
  unread: number
  lastMessageAt: number | null
  lastMessageText: string | null
  lastMessageFromMe: boolean
  /** Highest message primary key in the chat: changes whenever it gains one. */
  lastMessagePk: number
  messageCount: number
}

export interface MemberRow {
  jid: string
  name: string | null
}

export interface MessageRow {
  pk: number
  /** WhatsApp's own message id, unique within the chat. */
  stanzaId: string | null
  type: number
  text: string | null
  isFromMe: boolean
  /** Unix milliseconds. */
  sentAt: number
  /** In a group, the member who sent it; in a direct chat, null (the chat's partner). */
  senderJid: string | null
  senderName: string | null
  media: {
    path: string | null
    /** A mime type for media; the vCard itself for a contact card. */
    vcard: string | null
    title: string | null
    bytes: number
    latitude: number | null
    longitude: number | null
  } | null
}

/** A chat's readable text, without the U+FFFC WhatsApp, like Messages, can leave where media sat. */
export function cleanText(text: string | null | undefined): string | null {
  const clean = text?.replace(/￼/g, '').trim()
  return clean ? clean : null
}

export class WhatsAppDb {
  private readonly db: Database

  constructor(public readonly path: string = DEFAULT_WHATSAPP_DB) {
    try {
      this.db = new Database(path, { readonly: true })
      this.db.query('SELECT 1 FROM ZWACHATSESSION LIMIT 1').all()
    }
    catch (error) {
      throw new WhatsAppAccessError(path, error)
    }
  }

  close(): void {
    this.db.close()
  }

  /** Every chat a person would call a conversation (direct, group, community), or just the one with `jid`. */
  sessions(jid?: string): SessionRow[] {
    const rows = this.db.query(`
      SELECT s.Z_PK AS pk, s.ZCONTACTJID AS jid, s.ZSESSIONTYPE AS type, s.ZPARTNERNAME AS name,
        s.ZARCHIVED AS archived, s.ZUNREADCOUNT AS unread, s.ZLASTMESSAGEDATE AS lastDate,
        s.ZLASTMESSAGETEXT AS lastText, COALESCE(last.ZISFROMME, 0) AS lastFromMe,
        COALESCE((SELECT MAX(m.Z_PK) FROM ZWAMESSAGE m WHERE m.ZCHATSESSION = s.Z_PK), 0) AS lastPk,
        (SELECT COUNT(*) FROM ZWAMESSAGE m WHERE m.ZCHATSESSION = s.Z_PK) AS messageCount
      FROM ZWACHATSESSION s
      LEFT JOIN ZWAMESSAGE last ON last.Z_PK = s.ZLASTMESSAGE
      WHERE s.ZSESSIONTYPE IN (${SESSION_DIRECT}, ${SESSION_GROUP}, ${SESSION_COMMUNITY})
        AND COALESCE(s.ZHIDDEN, 0) = 0 AND COALESCE(s.ZREMOVED, 0) = 0
        AND s.ZCONTACTJID IS NOT NULL ${jid ? 'AND s.ZCONTACTJID = ?' : ''}
      ORDER BY s.ZLASTMESSAGEDATE DESC
    `).all(...(jid ? [jid] : [])) as Array<{ pk: number, jid: string, type: number, name: string | null, archived: number | null, unread: number | null, lastDate: number | null, lastText: string | null, lastFromMe: number, lastPk: number, messageCount: number }>
    return rows.map(r => ({
      pk: r.pk,
      jid: r.jid,
      type: r.type,
      name: cleanText(r.name),
      archived: !!r.archived,
      // -1 is "marked as unread" with no count behind it.
      unread: r.unread == null ? 0 : r.unread < 0 ? 1 : r.unread,
      lastMessageAt: appleDateToUnixMs(r.lastDate),
      lastMessageText: cleanText(r.lastText),
      lastMessageFromMe: !!r.lastFromMe,
      lastMessagePk: r.lastPk,
      messageCount: r.messageCount,
    }))
  }

  session(jid: string): SessionRow | undefined {
    return this.sessions(jid)[0]
  }

  /**
   * Where WhatsApp keeps each profile picture it has fetched, by JID: a path
   * relative to the container, stored with a `.jpg` or `.thumb` suffix (or
   * none). WhatsApp only keeps the ones it has shown recently.
   */
  profilePicturePaths(): Map<string, string> {
    try {
      const rows = this.db.query('SELECT ZJID AS jid, ZPATH AS path FROM ZWAPROFILEPICTUREITEM WHERE ZJID IS NOT NULL AND ZPATH IS NOT NULL').all() as Array<{ jid: string, path: string }>
      return new Map(rows.map(r => [r.jid, r.path]))
    }
    catch {
      // Pictures are a nicety: a store without the table just has none.
      return new Map()
    }
  }

  /** A group's current members, named the way WhatsApp names them. */
  members(sessionPk: number): MemberRow[] {
    const rows = this.db.query(`
      SELECT g.ZMEMBERJID AS jid, COALESCE(g.ZCONTACTNAME, g.ZFIRSTNAME, p.ZPUSHNAME) AS name
      FROM ZWAGROUPMEMBER g
      LEFT JOIN ZWAPROFILEPUSHNAME p ON p.ZJID = g.ZMEMBERJID
      WHERE g.ZCHATSESSION = ? AND COALESCE(g.ZISACTIVE, 1) = 1 AND g.ZMEMBERJID IS NOT NULL
      ORDER BY name
    `).all(sessionPk) as Array<{ jid: string, name: string | null }>
    return rows.map(r => ({ jid: r.jid, name: cleanText(r.name) }))
  }

  /**
   * A chat's messages in primary-key order, which is the order they reached
   * this Mac and so the order a cursor can resume from.
   */
  messages(sessionPk: number, options: { afterPk?: number, limit?: number, newestFirst?: boolean } = {}): MessageRow[] {
    const order = options.newestFirst ? 'DESC' : 'ASC'
    const limit = options.limit ? `LIMIT ${Math.max(1, Math.floor(options.limit))}` : ''
    const rows = this.db.query(`
      SELECT m.Z_PK AS pk, m.ZSTANZAID AS stanzaId, m.ZMESSAGETYPE AS type, m.ZTEXT AS text,
        m.ZISFROMME AS isFromMe, m.ZMESSAGEDATE AS date,
        g.ZMEMBERJID AS senderJid, COALESCE(g.ZCONTACTNAME, g.ZFIRSTNAME, p.ZPUSHNAME, m.ZPUSHNAME) AS senderName,
        i.Z_PK AS mediaPk, i.ZMEDIALOCALPATH AS mediaPath, i.ZVCARDSTRING AS vcard, i.ZTITLE AS title,
        i.ZFILESIZE AS bytes, i.ZLATITUDE AS latitude, i.ZLONGITUDE AS longitude
      FROM ZWAMESSAGE m
      LEFT JOIN ZWAGROUPMEMBER g ON g.Z_PK = m.ZGROUPMEMBER
      LEFT JOIN ZWAPROFILEPUSHNAME p ON p.ZJID = g.ZMEMBERJID
      LEFT JOIN ZWAMEDIAITEM i ON i.Z_PK = m.ZMEDIAITEM
      WHERE m.ZCHATSESSION = ? AND m.Z_PK > ?
      ORDER BY m.Z_PK ${order}
      ${limit}
    `).all(sessionPk, options.afterPk ?? 0) as Array<{
      pk: number
      stanzaId: string | null
      type: number
      text: string | null
      isFromMe: number
      date: number | null
      senderJid: string | null
      senderName: string | null
      mediaPk: number | null
      mediaPath: string | null
      vcard: string | null
      title: string | null
      bytes: number | null
      latitude: number | null
      longitude: number | null
    }>
    return rows.map(r => ({
      pk: r.pk,
      stanzaId: r.stanzaId,
      type: r.type,
      text: r.text,
      isFromMe: !!r.isFromMe,
      sentAt: appleDateToUnixMs(r.date) ?? 0,
      senderJid: r.senderJid,
      senderName: cleanText(r.senderName),
      media: r.mediaPk == null
        ? null
        : {
            path: r.mediaPath,
            vcard: r.vcard,
            title: r.title,
            bytes: r.bytes ?? 0,
            latitude: r.latitude,
            longitude: r.longitude,
          },
    }))
  }
}
