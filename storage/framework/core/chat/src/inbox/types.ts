/**
 * The inbox side of `@stacksjs/chat`: reading conversations out of the apps
 * people already use and archiving them there, behind one interface.
 *
 * `send()` and the webhook helpers push messages out. An inbox driver works
 * the other way round - it lists a person's conversations, reads their
 * messages, notices new ones, and takes a conversation out of the real app's
 * list when it is archived. Each provider can do that to a different extent,
 * and a driver says so through {@link ArchiveSupport} rather than pretending.
 */

export type InboxProvider = 'imessage' | 'slack' | 'discord' | 'whatsapp'

/**
 * How archiving a conversation takes it out of the real app.
 *
 * - `native`: the provider does it (Slack closes a DM; Discord archives a
 *   thread; WhatsApp's own Archive). Reversible through
 *   {@link InboxDriver.unarchive}.
 * - `confirm`: the app is driven to its own delete, which the person confirms
 *   there (iMessage: Apple offers no API, and Messages' own Delete is the only
 *   way that stays consistent with iCloud).
 * - `unsupported`: the provider has no per-person way to hide it. The
 *   conversation can still be archived in the inbox itself.
 */
export type ArchiveMode = 'native' | 'confirm' | 'unsupported'

export interface ArchiveSupport {
  mode: ArchiveMode
  /** One sentence a person can read, saying what archiving does here. */
  detail: string
}

export interface InboxPerson {
  /** Provider-scoped id: a handle, a Slack user id, a Discord user id. */
  id: string
  name: string | null
  /**
   * The person's profile picture, as a reference to pass to
   * {@link InboxDriver.avatar}. Absent or null when the app has none for them.
   */
  avatar?: string | null
}

export interface InboxConversation {
  provider: InboxProvider
  /** Stable for the life of the conversation, scoped to the provider. */
  id: string
  kind: 'direct' | 'group' | 'channel' | 'thread'
  /** What the provider calls it, if anything (a group or channel name). */
  title: string | null
  participants: InboxPerson[]
  /** The Slack workspace or Discord server it belongs to. */
  workspace: string | null
  lastMessageAt: number | null
  preview: string | null
  previewFromMe: boolean
  unread: number
  /**
   * Changes whenever the conversation gains a message. Comparing it with the
   * value seen last time is how a caller notices activity without reading
   * every message.
   */
  cursor: string
  /** The real app currently lists it. False once removed there. */
  visible: boolean
  /**
   * Messages the app has deleted but can still bring back (iMessage's
   * Recently Deleted). Read them with `includeDeleted`. 0 where the app has
   * no such thing.
   */
  deleted?: number
  archive: ArchiveSupport
  /** Opens the conversation in the real app, when the provider has a link. */
  url: string | null
  /** A group's or server's own picture, for {@link InboxDriver.avatar}. */
  avatar?: string | null
}

export interface InboxAttachment {
  id: string
  name: string
  mimeType: string | null
  bytes: number
  /** A file on this machine (iMessage, WhatsApp). */
  path: string | null
  /** A remote file (Slack, Discord); fetch it through the driver. */
  url: string | null
}

export interface InboxMessage {
  /** Provider-scoped and unique within the provider. */
  id: string
  conversationId: string
  kind: 'message' | 'reaction' | 'event'
  text: string | null
  fromMe: boolean
  /** Unix milliseconds. */
  sentAt: number
  sender: InboxPerson | null
  /** For a reaction: the message it reacts to, and the emoji. */
  targetId: string | null
  reaction: string | null
  /** True when this reaction takes an earlier one back. */
  reactionRemoved: boolean
  replyToId: string | null
  /**
   * The service that carried it, where a provider has several: Messages'
   * `iMessage`, `SMS` or `RCS`, which decide a bubble's colour. Null where a
   * provider has only the one.
   */
  service?: string | null
  editedAt: number | null
  unsent: boolean
  attachments: InboxAttachment[]
  /** Where reading resumes after this message: pass it as `after`. */
  cursor: string
}

export interface InboxStatus {
  connected: boolean
  /** What is missing when not connected, phrased as the next step. */
  detail: string
  /** A machine-readable reason, for a UI that offers a fix. */
  needs?: 'full-disk-access' | 'token' | 'messages-signed-out' | 'signed-out' | 'unsupported-platform'
}

export interface ArchiveOutcome {
  mode: ArchiveMode
  /**
   * The real app no longer lists it. False for `confirm` until the person
   * confirms (the caller sees it disappear on its next read), and always false
   * for `unsupported`.
   */
  removed: boolean
  detail: string
}

export interface MessageQuery {
  /** Only messages after this cursor (from {@link InboxMessage.cursor}). */
  after?: string
  /**
   * At most this many. With `after`, the first ones after the cursor (reading
   * forward); without it, the most recent ones - what a transcript shows.
   * Either way the result is oldest first.
   */
  limit?: number
  /**
   * Include messages the app has deleted but not yet purged (iMessage's
   * Recently Deleted), so a deleted conversation can still be kept.
   */
  includeDeleted?: boolean
}

export interface InboxDriver {
  readonly provider: InboxProvider
  readonly label: string
  status: () => Promise<InboxStatus>
  conversations: () => Promise<InboxConversation[]>
  /** Oldest first. */
  messages: (conversationId: string, query?: MessageQuery) => Promise<InboxMessage[]>
  /** Take it out of the real app's list, as far as the provider allows. */
  archive: (conversationId: string) => Promise<ArchiveOutcome>
  /** Put it back where the provider allows; a no-op where it does not. */
  unarchive: (conversationId: string) => Promise<void>
  /** Download a remote attachment with the driver's credentials. */
  attachment: (attachment: InboxAttachment) => Promise<Response>
  /**
   * The picture behind an `avatar` reference from a person or conversation:
   * read from this Mac (Contacts, WhatsApp) or fetched from the provider's
   * image host. 404 when there is none.
   */
  avatar?: (ref: string) => Promise<Response>
}

/** A `fetch` the HTTP drivers call, so tests and proxies can stand in. */
export type Fetch = (input: string, init?: RequestInit) => Promise<Response>
