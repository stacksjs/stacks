import type { ArchiveOutcome, InboxAttachment, InboxConversation, InboxDriver, InboxMessage, InboxStatus, MessageQuery } from '../types'
import type { LiveConversation } from './conversations'
import type { MessageRow } from './chat-db'
import { existsSync } from 'node:fs'
import { dirname } from 'node:path'
import process from 'node:process'
import { DEFAULT_MESSAGES_DB, MessagesAccessError, MessagesDb } from './chat-db'
import { Contacts, DEFAULT_ADDRESS_BOOK_DIR } from './contacts'
import { groupChats, messagesUrl } from './conversations'
import { imageResponse } from '../image'
import { formatHandle } from './handles'

/**
 * Something that can drive Messages' own Delete and Recover for one named
 * conversation - in Attic, a small Swift helper bundled with the app that
 * finds the row by name in Messages' accessibility tree and invokes that
 * row's own actions. `names` are every label Messages might show (contact
 * name, formatted number, raw handle); `confirm` also accepts Messages' alert.
 */
export interface MessagesController {
  remove: (names: string[], url: string | null, confirm: boolean) => Promise<{ ok: boolean, detail: string }>
  recover: (names: string[]) => Promise<{ ok: boolean, detail: string }>
}

export interface IMessageConfig {
  /**
   * Acts on the conversation by name instead of the menu's Delete
   * Conversation, which applies to whatever is selected. Strongly preferred.
   */
  controller?: MessagesController
  /** With a controller: accept Messages' delete alert too, rather than leave it to the person. */
  confirmDeletes?: boolean
  /** chat.db; the signed-in user's by default. */
  databasePath?: string
  /** Where Contacts keeps its stores, for names. `false` shows handles only. */
  addressBookDir?: string | false
  /** Opens a URL (a conversation in Messages). Defaults to macOS `open`. */
  openUrl?: (url: string) => void
  /** The host OS; `process.platform` by default. iMessage exists only on darwin. */
  platform?: NodeJS.Platform
}

/** Messages' reaction types and the emoji they stand for. 3000+ removes. */
const REACTIONS: Record<number, string> = {
  2000: '❤️',
  2001: '👍',
  2002: '👎',
  2003: '😂',
  2004: '‼️',
  2005: '❓',
  2006: '😀',
  2007: '🔖',
}

function defaultOpen(url: string): void {
  Bun.spawn(['/usr/bin/open', url], { stdio: ['ignore', 'ignore', 'ignore'] })
}

/**
 * iMessage and SMS, read from the Messages database on this Mac.
 *
 * Reading needs Full Disk Access for the process (chat.db and Contacts sit
 * behind macOS privacy controls); nothing here ever writes to either. Apple
 * offers no API for archiving or hiding a conversation, and an edit to
 * chat.db behind Messages' back is ignored or synced to every device, so
 * archiving opens the conversation in Messages and invokes its own Delete
 * Conversation, which the person confirms. Messages keeps it in Recently
 * Deleted for 30 days, and a new message brings the thread back on its own.
 * Give it a `controller` to have that done by name; without one it only
 * opens the conversation for the person to delete.
 */
export class IMessageDriver implements InboxDriver {
  readonly provider = 'imessage' as const
  readonly label = 'iMessage'
  private readonly databasePath: string
  private readonly addressBookDir: string | false
  private readonly openUrl: (url: string) => void
  private readonly controller: MessagesController | undefined
  private readonly confirmDeletes: boolean
  private readonly platform: NodeJS.Platform
  private contacts: Contacts | null = null
  private contactsLoadedAt = 0

  constructor(config: IMessageConfig = {}) {
    this.databasePath = config.databasePath ?? DEFAULT_MESSAGES_DB
    this.addressBookDir = config.addressBookDir ?? DEFAULT_ADDRESS_BOOK_DIR
    this.openUrl = config.openUrl ?? defaultOpen
    this.controller = config.controller
    this.confirmDeletes = config.confirmDeletes ?? false
    this.platform = config.platform ?? process.platform
  }

  /** Every label Messages might give the conversation's row. */
  private rowNames(c: LiveConversation): string[] {
    const names: Array<string | null> = []
    if (c.kind === 'group')
      names.push(c.displayName)
    else if (c.participants[0])
      names.push(this.names().nameFor(c.participants[0]), formatHandle(c.participants[0]), c.participants[0])
    return [...new Set(names.filter((n): n is string => !!n))]
  }

  private open<T>(fn: (db: MessagesDb) => T): T {
    const db = new MessagesDb(this.databasePath)
    try {
      return fn(db)
    }
    finally {
      db.close()
    }
  }

  private names(): Contacts {
    if (this.addressBookDir === false)
      return this.contacts ??= new Contacts()
    // Contacts changes rarely; re-read it every ten minutes at most.
    if (!this.contacts || Date.now() - this.contactsLoadedAt > 10 * 60_000) {
      this.contacts = Contacts.load(this.addressBookDir)
      this.contactsLoadedAt = Date.now()
    }
    return this.contacts
  }

  private person(handle: string | null): { id: string, name: string | null, avatar: string | null } | null {
    if (!handle)
      return null
    const contacts = this.names()
    return { id: handle, name: contacts.nameFor(handle), avatar: contacts.hasPhoto(handle) ? handle : null }
  }

  /** A contact's photo from Contacts; the reference is the handle. */
  async avatar(ref: string): Promise<Response> {
    return imageResponse(this.names().photo(ref))
  }

  private find(db: MessagesDb, id: string): LiveConversation | undefined {
    return groupChats(db.chats()).find(c => c.key === id)
  }

  async status(): Promise<InboxStatus> {
    if (this.platform !== 'darwin')
      return { connected: false, detail: 'iMessage is only available on a Mac.', needs: 'unsupported-platform' }
    try {
      this.open(() => undefined)
      return { connected: true, detail: 'Reading Messages on this Mac.' }
    }
    catch (error) {
      if (error instanceof MessagesAccessError && error.needsFullDiskAccess && existsSync(dirname(this.databasePath)))
        return { connected: false, detail: 'Grant Full Disk Access in System Settings > Privacy & Security.', needs: 'full-disk-access' }
      return { connected: false, detail: 'Sign in to Messages on this Mac.', needs: 'messages-signed-out' }
    }
  }

  async conversations(): Promise<InboxConversation[]> {
    return this.open(db => groupChats(db.chats()).map(c => this.toConversation(c)))
  }

  private toConversation(c: LiveConversation): InboxConversation {
    const url = messagesUrl(c)
    return {
      provider: 'imessage',
      id: c.key,
      kind: c.kind,
      title: c.kind === 'group' ? c.displayName : null,
      participants: c.participants.map(handle => this.person(handle)!),
      workspace: null,
      lastMessageAt: c.lastMessageAt,
      preview: c.messageCount > 0 ? c.lastMessageText : null,
      previewFromMe: c.lastMessageFromMe,
      unread: c.unreadCount,
      cursor: String(c.lastMessageRowId),
      visible: c.messageCount > 0,
      deleted: c.recoverableCount,
      archive: url
        ? { mode: 'confirm', detail: 'Opens it in Messages at Delete Conversation for you to confirm. Messages keeps it in Recently Deleted for 30 days.' }
        : { mode: 'unsupported', detail: 'Messages cannot open this conversation by address, so delete it there yourself.' },
      url,
    }
  }

  async messages(conversationId: string, query: MessageQuery = {}): Promise<InboxMessage[]> {
    return this.open((db) => {
      const conversation = this.find(db, conversationId)
      if (!conversation)
        return []
      // Reading forward from a cursor walks ROWIDs up; a bare limit wants the
      // newest messages, fetched newest first and turned back around.
      const includeDeleted = query.includeDeleted
      const rows = query.after || !query.limit
        ? db.messages(conversation.chatGuids, { afterRowId: Number(query.after) || 0, byRowId: true, limit: query.limit, includeDeleted })
        : db.messages(conversation.chatGuids, { newestFirst: true, limit: query.limit, includeDeleted }).reverse()
      return rows.map(row => this.toMessage(conversationId, row))
    })
  }

  private toMessage(conversationId: string, row: MessageRow): InboxMessage {
    const removed = row.reactionType >= 3000
    return {
      id: row.guid,
      conversationId,
      kind: row.kind,
      text: row.kind === 'event' && row.groupTitle ? `Named the conversation “${row.groupTitle}”` : row.text,
      fromMe: row.isFromMe,
      sentAt: row.sentAt,
      sender: row.isFromMe ? null : this.person(row.sender),
      targetId: row.targetGuid,
      reaction: row.kind === 'reaction' ? (REACTIONS[removed ? row.reactionType - 1000 : row.reactionType] ?? '•') : null,
      reactionRemoved: removed,
      replyToId: row.replyToGuid,
      editedAt: row.editedAt,
      unsent: row.unsent,
      attachments: row.attachments.map((a): InboxAttachment => ({
        id: a.guid,
        name: a.name,
        mimeType: a.mimeType,
        bytes: a.bytes,
        path: a.path && existsSync(a.path) ? a.path : null,
        url: null,
      })),
      cursor: String(row.rowid),
    }
  }

  async archive(conversationId: string): Promise<ArchiveOutcome> {
    const conversation = this.open(db => this.find(db, conversationId))
    const url = conversation ? messagesUrl(conversation) : null
    if (!conversation || !url)
      return { mode: 'unsupported', removed: false, detail: 'Messages cannot open this conversation by address, so delete it there yourself.' }
    if (conversation.messageCount === 0)
      return { mode: 'confirm', removed: true, detail: 'Already gone from Messages.' }

    const names = this.rowNames(conversation)
    if (this.controller && names.length > 0) {
      const result = await this.controller.remove(names, url, this.confirmDeletes)
      return {
        mode: 'confirm',
        removed: false,
        detail: result.ok ? (this.confirmDeletes ? 'Deleted in Messages.' : 'Messages is asking you to confirm the delete.') : result.detail,
      }
    }

    // Without a controller, only open it. Clicking Conversation > Delete
    // Conversation would act on whatever Messages has selected, which is the
    // conversation just opened only if the URL landed - not something to
    // gamble a person's messages on.
    this.openUrl(url)
    return {
      mode: 'confirm',
      removed: false,
      detail: 'Messages is open on the conversation: choose Conversation > Delete Conversation to finish.',
    }
  }

  /**
   * With a controller, recovers the conversation from Messages' Recently
   * Deleted (it keeps deletions for 30 days). Without one there is no way in
   * from outside, and this does nothing.
   */
  async unarchive(conversationId: string): Promise<void> {
    if (!this.controller)
      return
    const conversation = this.open(db => this.find(db, conversationId))
    if (!conversation || conversation.messageCount > 0)
      return
    const names = this.rowNames(conversation)
    if (names.length > 0)
      await this.controller.recover(names)
  }

  async attachment(attachment: InboxAttachment): Promise<Response> {
    if (!attachment.path || !existsSync(attachment.path))
      return new Response('Not found', { status: 404 })
    return new Response(Bun.file(attachment.path), { headers: { 'content-type': attachment.mimeType ?? 'application/octet-stream' } })
  }
}
