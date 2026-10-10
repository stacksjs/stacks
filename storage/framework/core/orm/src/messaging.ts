import { createHash } from 'node:crypto'
import { db, parseSqlDateTime, sqlDateTime } from '@stacksjs/database/runtime'
import { emit, getServer } from '@stacksjs/realtime'

export class MessagingError extends Error {
  constructor(message: string, public status: number) { super(message) }
}

export interface MessagingOptions {
  actorId: number
  /** A server-selected tenant or workspace. Never accept this directly from a form. */
  scope: string
  participantType?: string
  enabled?: boolean
  maxLength?: number
  pageSize?: number
  /** Private invalidation broadcasts through the native realtime engine. Default: true. */
  broadcast?: boolean
  /** Required, and checked again on reads, sends and read receipts. */
  authorize: (actorId: number, recipientId: number) => boolean | Promise<boolean>
}

/** Private per-person inbox, isolated from other model participant types. */
export function messagingChannel(participantType: string, userId: number): string {
  return `private-messaging.${createHash('sha256').update(participantType).digest('hex')}.${positive(userId)}`
}

export interface DirectConversation {
  id: string
  recipient_id: number
  last_message: DirectMessage | null
  unread: number
}
export interface DirectMessage {
  id: number
  conversation_id: string
  sender_id: number
  body: string
  client_key: string
  created_at: string
  read_at: string | null
}

function positive(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) <= 0)
    throw new MessagingError('A positive integer is required', 422)
  return Number(value)
}
function duplicate(error: unknown): boolean {
  const e = error as { code?: string, errno?: number }
  return e.code === '23505' || e.code === 'SQLITE_CONSTRAINT_PRIMARYKEY' || e.code === 'SQLITE_CONSTRAINT_UNIQUE' || e.code === 'SQLITE_CONSTRAINT' || e.errno === 1062
}
function message(row: Record<string, unknown>): DirectMessage {
  return { id: Number(row.id), conversation_id: String(row.conversation_id), sender_id: Number(row.sender_id), body: String(row.body), client_key: String(row.client_key), created_at: parseSqlDateTime(row.created_at)!.toISOString(), read_at: parseSqlDateTime(row.read_at)?.toISOString() ?? null }
}

export interface Messenger {
  direct: (recipientId: number) => Promise<{ id: string, recipient_id: number }>
  list: () => Promise<DirectConversation[]>
  messages: (id: string, before?: number) => Promise<{ messages: DirectMessage[], has_more: boolean }>
  send: (id: string, body: string, clientKey: string) => Promise<DirectMessage>
  markRead: (id: string, throughId: number) => Promise<void>
}

/** Direct conversations with persistence, tenant isolation, receipts and safe retries. */
export function createMessenger(options: MessagingOptions): Messenger {
  const actorId = positive(options.actorId)
  const participantType = options.participantType ?? 'users'
  const maxLength = options.maxLength ?? 4000
  const pageSize = options.pageSize ?? 50
  if (!options.scope || options.scope.length > 255 || !participantType || participantType.length > 255 || typeof options.authorize !== 'function' || !Number.isSafeInteger(maxLength) || maxLength < 1 || maxLength > 100000 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100)
    throw new MessagingError('Invalid messaging configuration', 422)

  async function authorize(recipientId: number) {
    if (options.enabled === false) throw new MessagingError('Messaging is disabled', 403)
    if (recipientId === actorId || !await options.authorize(actorId, recipientId))
      throw new MessagingError('Conversation not found', 404)
  }
  async function conversation(id: string) {
    if (typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id)) throw new MessagingError('Conversation not found', 404)
    const row = await db.selectFrom('chat_conversations').selectAll().where('id', '=', id).where('scope', '=', options.scope).where('participant_type', '=', participantType).executeTakeFirst()
    if (!row || (Number(row.first_id) !== actorId && Number(row.second_id) !== actorId)) throw new MessagingError('Conversation not found', 404)
    const recipientId = Number(row.first_id) === actorId ? Number(row.second_id) : Number(row.first_id)
    await authorize(recipientId)
    return recipientId
  }
  async function direct(recipientId: number): Promise<{ id: string, recipient_id: number }> {
    positive(recipientId)
    await authorize(recipientId)
    const [first, second] = [actorId, recipientId].sort((a, b) => a - b)
    const id = createHash('sha256').update(JSON.stringify([options.scope, participantType, first, second])).digest('hex')
    const existing = await db.selectFrom('chat_conversations').select('id').where('id', '=', id).executeTakeFirst()
    if (!existing) {
      try {
        await db.insertInto('chat_conversations').values({ id, scope: options.scope, participant_type: participantType, first_id: first, second_id: second, created_at: sqlDateTime() }).execute()
      }
      catch (error) { if (!duplicate(error)) throw error }
    }
    return { id, recipient_id: recipientId }
  }
  async function list(): Promise<DirectConversation[]> {
    if (options.enabled === false) throw new MessagingError('Messaging is disabled', 403)
    // Two indexed queries avoid an untyped OR predicate and preserve tenant scoping.
    const query = () => db.selectFrom('chat_conversations').selectAll().where('scope', '=', options.scope).where('participant_type', '=', participantType)
    const rows = [...await query().where('first_id', '=', actorId).execute(), ...await query().where('second_id', '=', actorId).execute()]
    const results: DirectConversation[] = []
    for (const row of rows) {
      const recipientId = Number(row.first_id) === actorId ? Number(row.second_id) : Number(row.first_id)
      if (!await options.authorize(actorId, recipientId)) continue
      const latest = await db.selectFrom('chat_messages').selectAll().where('conversation_id', '=', row.id).orderBy('id', 'desc').limit(1).executeTakeFirst()
      const unread = await db.selectFrom('chat_messages').select('id').where('conversation_id', '=', row.id).where('sender_id', '=', recipientId).whereNull('read_at').count()
      results.push({ id: String(row.id), recipient_id: recipientId, last_message: latest ? message(latest) : null, unread: Number(unread) })
    }
    return results.sort((a, b) => (b.last_message?.id ?? 0) - (a.last_message?.id ?? 0))
  }
  async function messages(id: string, before?: number) {
    await conversation(id)
    let query = db.selectFrom('chat_messages').selectAll().where('conversation_id', '=', id)
    if (before !== undefined) query = query.where('id', '<', positive(before))
    const rows = await query.orderBy('id', 'desc').limit(pageSize + 1).execute()
    return { messages: rows.slice(0, pageSize).reverse().map(message), has_more: rows.length > pageSize }
  }
  async function send(id: string, body: string, clientKey: string): Promise<DirectMessage> {
    const recipientId = await conversation(id)
    if (typeof body !== 'string' || !body.trim() || body.trim().length > maxLength) throw new MessagingError(`Write a message of 1 to ${maxLength} characters`, 422)
    if (typeof clientKey !== 'string' || !/^[\w-]{1,100}$/.test(clientKey)) throw new MessagingError('A valid message retry key is required', 422)
    const lookup = () => db.selectFrom('chat_messages').selectAll().where('conversation_id', '=', id).where('sender_id', '=', actorId).where('client_key', '=', clientKey).executeTakeFirst()
    let row = await lookup()
    let inserted = false
    if (!row) {
      try {
        await db.insertInto('chat_messages').values({ conversation_id: id, sender_id: actorId, body: body.trim(), client_key: clientKey, created_at: sqlDateTime(), read_at: null }).execute()
        inserted = true
      }
      catch (error) { if (!duplicate(error)) throw error }
      row = await lookup()
    }
    if (!row) throw new Error('Message could not be saved')
    if (row.body !== body.trim()) throw new MessagingError('This retry key belongs to a different message', 409)
    if (inserted) notify(recipientId, id, 'messaging.sent')
    return message(row)
  }
  async function markRead(id: string, throughId: number) {
    const recipientId = await conversation(id)
    positive(throughId)
    const seen = await db.selectFrom('chat_messages').select('id').where('conversation_id', '=', id).where('id', '=', throughId).executeTakeFirst()
    if (!seen) throw new MessagingError('Message not found', 404)
    const unread = await db.selectFrom('chat_messages').select('id').where('conversation_id', '=', id).where('sender_id', '=', recipientId).where('id', '<=', throughId).whereNull('read_at').limit(1).executeTakeFirst()
    await db.updateTable('chat_messages').set({ read_at: sqlDateTime() }).where('conversation_id', '=', id).where('sender_id', '=', recipientId).where('id', '<=', throughId).whereNull('read_at').execute()
    if (unread) notify(recipientId, id, 'messaging.read')
  }
  function notify(recipientId: number, id: string, event: string) {
    if (options.broadcast === false || !getServer()) return
    // No message text or identity data goes on the wire. Consumers re-read through their current policy.
    for (const userId of [actorId, recipientId]) emit(messagingChannel(participantType, userId), event, { conversation_id: id })
  }
  return { direct, list, messages, send, markRead }
}

/** Opt-in model trait, binding the hydrated record's id and model table. */
export function createMessagingMethods(participantType: string): { messenger: (id: number, options: Omit<MessagingOptions, 'actorId' | 'participantType'>) => Messenger } {
  return { messenger: (id: number, options: Omit<MessagingOptions, 'actorId' | 'participantType'>) => createMessenger({ ...options, actorId: id, participantType }) }
}
