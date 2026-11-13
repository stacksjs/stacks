export type SupportErrorCode = 'configuration' | 'validation' | 'unauthorized' | 'forbidden' | 'not_found' | 'conflict' | 'quota_exceeded' | 'unavailable' | 'timeout' | 'network' | 'bad_response'

export type SupportFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

export interface SupportIdentity {
  externalId: string
  email?: string
  name?: string
  company?: { id: string, name?: string }
  attributes?: Record<string, string | number | boolean | null>
}

export interface CustomerSession {
  token: string
  expiresAt: string
  contact: { id: string, externalId?: string, name?: string, email?: string }
}

export interface ConversationSummary {
  id: string
  subject: string
  status: string
  customer_id: string
  updated_at: string
  unread_count: number
}

export interface ConversationPage {
  conversations: ConversationSummary[]
  nextCursor: string | null
}

export interface ConversationQuery {
  cursor?: string
  status?: string
  limit?: number
}

export interface CreateConversation {
  externalId: string
  subject: string
  body: string
  idempotencyKey: string
}

export interface ReplyInput {
  body: string
  visibility: 'public' | 'internal'
  idempotencyKey: string
}

export interface SupportMessage {
  id: string
  conversation_id: string
  body: string
  visibility: 'public' | 'internal'
  created_at: string
}

export interface SupportEvent {
  externalId: string
  event: string
  attributes?: Record<string, string | number | boolean | null>
  idempotencyKey: string
}

export interface SupportClientOptions {
  url?: string
  key: string
  readKey?: string
  project: string
  timeoutMs?: number
  fetch?: SupportFetch
}

export interface SupportClient {
  createSession: (identity: SupportIdentity) => Promise<CustomerSession>
  track: (event: SupportEvent) => Promise<{ id: string, accepted: true }>
  conversations: {
    create: (input: CreateConversation) => Promise<{ conversation: ConversationSummary }>
    reply: (id: string, input: ReplyInput) => Promise<{ message: SupportMessage }>
    list: (query?: ConversationQuery) => Promise<ConversationPage>
  }
}
