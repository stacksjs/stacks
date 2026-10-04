import { Database } from 'bun:sqlite'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { encodeAttributedBody } from '../../src/inbox/imessage/typedstream'

/**
 * A chat.db laid out the way Messages writes it, for the tests and for
 * `bun run app:sample`, which runs Attic against invented conversations
 * instead of the real ones. It has the tables and columns Attic reads: text only in `attributedBody`, Apple-epoch nanosecond dates,
 * one chat row per service, reactions pointing at `p:0/<guid>`, attachments
 * under `~/Library/Messages/Attachments`-style paths, and deletion modelled
 * the way Ventura and later do it - the message leaves `chat_message_join`
 * and lands in `chat_recoverable_message_join`.
 */

const APPLE_EPOCH_MS = 978_307_200_000

export const ALICE = '+15550002222'
export const BOB = 'bob@example.com'
export const CAROL = '+15550003333'

export interface AddMessage {
  text: string
  fromMe?: boolean
  at?: number
  sender?: string
  reaction?: { type: number, target: string }
  attachment?: { name: string, mime: string, bytes?: string | null }
  read?: boolean
  /** The guid of the message this is an inline reply to. */
  replyTo?: string
}

export class FakeChatDb {
  readonly dir: string
  readonly path: string
  readonly db: Database
  private handles = new Map<string, number>()
  private seq = 0
  /** The last message added to each chat: Messages' `reply_to_guid`. */
  private latest = new Map<number, string>()
  private clock = Date.UTC(2026, 0, 1, 12)

  /** A fresh chat.db in `dir`, or in a new temporary directory. */
  constructor(dir?: string) {
    this.dir = dir ?? mkdtempSync(join(tmpdir(), 'attic-chatdb-'))
    mkdirSync(this.dir, { recursive: true })
    this.path = join(this.dir, 'chat.db')
    for (const suffix of ['', '-wal', '-shm'])
      rmSync(`${this.path}${suffix}`, { force: true })
    this.db = new Database(this.path)
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE handle (ROWID INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL, service TEXT NOT NULL);
      CREATE TABLE chat (
        ROWID INTEGER PRIMARY KEY AUTOINCREMENT, guid TEXT UNIQUE NOT NULL, style INTEGER, state INTEGER,
        chat_identifier TEXT, service_name TEXT, room_name TEXT, display_name TEXT, group_id TEXT,
        is_archived INTEGER DEFAULT 0, is_filtered INTEGER DEFAULT 0, properties BLOB
      );
      CREATE TABLE message (
        ROWID INTEGER PRIMARY KEY AUTOINCREMENT, guid TEXT UNIQUE NOT NULL, text TEXT, attributedBody BLOB,
        handle_id INTEGER DEFAULT 0, service TEXT, date INTEGER, date_read INTEGER DEFAULT 0, is_read INTEGER DEFAULT 0,
        is_from_me INTEGER DEFAULT 0, associated_message_guid TEXT, associated_message_type INTEGER DEFAULT 0,
        item_type INTEGER DEFAULT 0, group_title TEXT, cache_has_attachments INTEGER DEFAULT 0,
        reply_to_guid TEXT, thread_originator_guid TEXT, date_edited INTEGER DEFAULT 0, date_retracted INTEGER DEFAULT 0,
        destination_caller_id TEXT, account TEXT
      );
      CREATE TABLE chat_message_join (chat_id INTEGER, message_id INTEGER, message_date INTEGER DEFAULT 0, PRIMARY KEY (chat_id, message_id));
      CREATE TABLE chat_handle_join (chat_id INTEGER, handle_id INTEGER, UNIQUE (chat_id, handle_id));
      CREATE TABLE attachment (
        ROWID INTEGER PRIMARY KEY AUTOINCREMENT, guid TEXT UNIQUE NOT NULL, created_date INTEGER DEFAULT 0,
        filename TEXT, uti TEXT, mime_type TEXT, transfer_name TEXT, total_bytes INTEGER DEFAULT 0, is_sticker INTEGER DEFAULT 0
      );
      CREATE TABLE message_attachment_join (message_id INTEGER, attachment_id INTEGER, UNIQUE (message_id, attachment_id));
      CREATE TABLE chat_recoverable_message_join (chat_id INTEGER, message_id INTEGER, delete_date INTEGER, PRIMARY KEY (chat_id, message_id));
    `)
  }

  private handle(id: string): number {
    const existing = this.handles.get(id)
    if (existing)
      return existing
    this.db.query('INSERT INTO handle (id, service) VALUES (?, ?)').run(id, 'iMessage')
    const rowid = this.lastId()
    this.handles.set(id, rowid)
    return rowid
  }

  private lastId(): number {
    return (this.db.query('SELECT last_insert_rowid() AS id').get() as { id: number }).id
  }

  /** A direct chat. `service` is the guid prefix: iMessage, SMS or any. */
  direct(handle: string, service = 'iMessage'): number {
    const guid = `${service};-;${handle}`
    const existing = this.db.query('SELECT ROWID AS id FROM chat WHERE guid = ?').get(guid) as { id: number } | null
    if (existing)
      return existing.id
    this.db.query('INSERT INTO chat (guid, style, chat_identifier, service_name) VALUES (?, 45, ?, ?)').run(guid, handle, service === 'any' ? 'iMessage' : service)
    const id = this.lastId()
    this.db.query('INSERT INTO chat_handle_join (chat_id, handle_id) VALUES (?, ?)').run(id, this.handle(handle))
    return id
  }

  group(identifier: string, members: string[], options: { name?: string, groupId?: string } = {}): number {
    const guid = `iMessage;+;${identifier}`
    const existing = this.db.query('SELECT ROWID AS id FROM chat WHERE guid = ?').get(guid) as { id: number } | null
    if (existing)
      return existing.id
    this.db.query('INSERT INTO chat (guid, style, chat_identifier, service_name, display_name, group_id) VALUES (?, 43, ?, ?, ?, ?)')
      .run(guid, identifier, 'iMessage', options.name ?? '', options.groupId ?? `GROUP-${identifier}`)
    const id = this.lastId()
    for (const member of members)
      this.db.query('INSERT INTO chat_handle_join (chat_id, handle_id) VALUES (?, ?)').run(id, this.handle(member))
    return id
  }

  /**
   * Gives a group the photo Messages stores for it: an attachment row, its
   * file, and the attachment's guid in the chat's binary property list.
   */
  groupPhoto(chatId: number, properties: Uint8Array, guid: string, bytes: Uint8Array | null): void {
    let filename: string | null = null
    if (bytes) {
      const folder = join(this.dir, 'Attachments', 'group-photo')
      mkdirSync(folder, { recursive: true })
      filename = join(folder, `${guid}.jpeg`)
      writeFileSync(filename, bytes)
    }
    this.db.query('INSERT INTO attachment (guid, filename, mime_type, transfer_name) VALUES (?, ?, ?, ?)').run(guid, filename, 'image/jpeg', 'GroupPhoto.jpeg')
    this.db.query('UPDATE chat SET properties = ? WHERE ROWID = ?').run(properties, chatId)
  }

  /** Adds a message and returns its guid. */
  add(chatId: number, message: AddMessage): string {
    const at = message.at ?? (this.clock += 60_000)
    const fromMe = message.fromMe ?? false
    const chat = this.db.query('SELECT chat_identifier, style FROM chat WHERE ROWID = ?').get(chatId) as { chat_identifier: string, style: number }
    const sender = fromMe ? null : (message.sender ?? (chat.style === 45 ? chat.chat_identifier : null))
    const guid = `MSG-${++this.seq}`
    this.db.query(`
      INSERT INTO message (guid, text, attributedBody, handle_id, service, date, is_read, is_from_me,
        associated_message_guid, associated_message_type, cache_has_attachments, reply_to_guid, thread_originator_guid)
      VALUES (?, NULL, ?, ?, 'iMessage', ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      guid,
      encodeAttributedBody(message.text),
      sender ? this.handle(sender) : 0,
      (at - APPLE_EPOCH_MS) * 1_000_000,
      message.read === false ? 0 : 1,
      fromMe ? 1 : 0,
      message.reaction ? `p:0/${message.reaction.target}` : null,
      message.reaction?.type ?? 0,
      message.attachment ? 1 : 0,
      // As Messages fills it: the message before this one in the chat,
      // whether or not this one is a reply.
      this.latest.get(chatId) ?? null,
      message.replyTo ?? null,
    )
    this.latest.set(chatId, guid)
    const rowid = this.lastId()
    this.db.query('INSERT INTO chat_message_join (chat_id, message_id, message_date) VALUES (?, ?, ?)').run(chatId, rowid, (at - APPLE_EPOCH_MS) * 1_000_000)

    if (message.attachment) {
      let filename: string | null = null
      if (message.attachment.bytes !== null) {
        const folder = join(this.dir, 'Attachments', String(this.seq))
        mkdirSync(folder, { recursive: true })
        filename = join(folder, message.attachment.name)
        writeFileSync(filename, message.attachment.bytes ?? `bytes of ${message.attachment.name}`)
      }
      this.db.query('INSERT INTO attachment (guid, filename, mime_type, transfer_name, total_bytes) VALUES (?, ?, ?, ?, ?)')
        .run(`ATT-${this.seq}`, filename, message.attachment.mime, message.attachment.name, 1234)
      this.db.query('INSERT INTO message_attachment_join (message_id, attachment_id) VALUES (?, ?)').run(rowid, this.lastId())
    }
    return guid
  }

  /** What Messages' Delete Conversation does since Ventura. */
  deleteChat(chatId: number): void {
    const rows = this.db.query('SELECT message_id FROM chat_message_join WHERE chat_id = ?').all(chatId) as Array<{ message_id: number }>
    for (const { message_id } of rows)
      this.db.query('INSERT INTO chat_recoverable_message_join (chat_id, message_id, delete_date) VALUES (?, ?, 0)').run(chatId, message_id)
    this.db.query('DELETE FROM chat_message_join WHERE chat_id = ?').run(chatId)
  }

  /** Recently Deleted emptied: the messages and their files are gone for good. */
  purge(chatId: number): void {
    const rows = this.db.query('SELECT message_id FROM chat_recoverable_message_join WHERE chat_id = ?').all(chatId) as Array<{ message_id: number }>
    for (const { message_id } of rows) {
      this.db.query('DELETE FROM message WHERE ROWID = ?').run(message_id)
    }
    this.db.query('DELETE FROM chat_recoverable_message_join WHERE chat_id = ?').run(chatId)
    this.db.query('DELETE FROM chat_handle_join WHERE chat_id = ?').run(chatId)
    this.db.query('DELETE FROM chat WHERE ROWID = ?').run(chatId)
  }

  attachmentPath(guid: string): string | null {
    return (this.db.query('SELECT filename FROM attachment WHERE guid = ?').get(guid) as { filename: string | null } | null)?.filename ?? null
  }

  close(): void {
    this.db.close()
  }
}
