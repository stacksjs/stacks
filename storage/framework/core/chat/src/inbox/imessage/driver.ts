import type { ArchiveOutcome, InboxAttachment, InboxConversation, InboxDriver, InboxMessage, InboxStatus, MessageQuery } from '../types'
import type { LiveConversation } from './conversations'
import type { MessageRow } from './chat-db'
import { existsSync } from 'node:fs'
import { dirname } from 'node:path'
import process from 'node:process'
import { DEFAULT_MESSAGES_DB, MessagesAccessError, MessagesDb } from './chat-db'
import { Contacts, DEFAULT_ADDRESS_BOOK_DIR } from './contacts'
import { groupChats, messagesUrl } from './conversations'

export interface IMessageConfig {
  /** chat.db; the signed-in user's by default. */
  databasePath?: string
  /** Where Contacts keeps its stores, for names. `false` shows handles only. */
  addressBookDir?: string | false
  /** Opens a URL (a conversation in Messages). Defaults to macOS `open`. */
  openUrl?: (url: string) => void
  /** Runs AppleScript; resolves false when it could not (no permission). */
  runAppleScript?: (script: string) => Promise<boolean>
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

/**
 * Takes Messages to its own Delete Conversation for the conversation just
 * opened. Messages asks the person to confirm, so nothing is deleted without
 * them seeing which conversation it is - the safety a script that clicked
 * through the confirmation as well would throw away.
 */
const DELETE_SCRIPT = `
tell application "Messages" to activate
delay 0.8
tell application "System Events" to tell process "Messages"
  click menu item "Delete Conversation…" of menu "Conversation" of menu bar 1
end tell
`

function defaultOpen(url: string): void {
  Bun.spawn(['/usr/bin/open', url], { stdio: ['ignore', 'ignore', 'ignore'] })
}

async function defaultAppleScript(script: string): Promise<boolean> {
  const run = Bun.spawn(['/usr/bin/osascript', '-e', script], { stdio: ['ignore', 'ignore', 'ignore'] })
  return (await run.exited) === 0
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
 */
export class IMessageDriver implements InboxDriver {
  readonly provider = 'imessage' as const
  readonly label = 'iMessage'
  private readonly databasePath: string
  private readonly addressBookDir: string | false
  private readonly openUrl: (url: string) => void
  private readonly runAppleScript: (script: string) => Promise<boolean>
  private contacts: Contacts | null = null
  private contactsLoadedAt = 0

  constructor(config: IMessageConfig = {}) {
    this.databasePath = config.databasePath ?? DEFAULT_MESSAGES_DB
    this.addressBookDir = config.addressBookDir ?? DEFAULT_ADDRESS_BOOK_DIR
    this.openUrl = config.openUrl ?? defaultOpen
    this.runAppleScript = config.runAppleScript ?? defaultAppleScript
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

  private person(handle: string | null): { id: string, name: string | null } | null {
    return handle ? { id: handle, name: this.names().nameFor(handle) } : null
  }

  private find(db: MessagesDb, id: string): LiveConversation | undefined {
    return groupChats(db.chats()).find(c => c.key === id)
  }

  async status(): Promise<InboxStatus> {
    if (process.platform !== 'darwin')
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
      const rows = db.messages(conversation.chatGuids, { afterRowId: Number(query.after) || 0, byRowId: true, limit: query.limit })
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

    this.openUrl(url)
    const prompted = await this.runAppleScript(DELETE_SCRIPT)
    return {
      mode: 'confirm',
      removed: false,
      detail: prompted
        ? 'Messages is asking you to confirm the delete.'
        : 'Messages is open on the conversation: choose Conversation > Delete Conversation to finish. (Allow Accessibility access to have this done for you.)',
    }
  }

  /** Messages has no way to restore from outside: Recently Deleted holds it for 30 days. */
  async unarchive(): Promise<void> {}

  async attachment(attachment: InboxAttachment): Promise<Response> {
    if (!attachment.path || !existsSync(attachment.path))
      return new Response('Not found', { status: 404 })
    return new Response(Bun.file(attachment.path), { headers: { 'content-type': attachment.mimeType ?? 'application/octet-stream' } })
  }
}
