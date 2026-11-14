import type { ConversationPage, ConversationSummary, CustomerSession, SupportClient, SupportClientOptions, SupportErrorCode, SupportMessage } from './types'

export type * from './types'

/** A safe error: provider bodies and credentials never become error messages. */
export class SupportError extends Error {
  constructor(public readonly code: SupportErrorCode, public readonly status: number = 0) {
    super(`HQ.support request failed (${code}).`)
    this.name = 'SupportError'
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function nonEmpty(value: unknown, max = 255): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max
}

function validate(value: unknown, max = 255): asserts value is string {
  if (!nonEmpty(value, max))
    throw new SupportError('validation')
}

function serviceUrl(input: string): string {
  let url: URL
  try { url = new URL(input) }
  catch { throw new SupportError('configuration') }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && !(local && url.protocol === 'http:')))
    throw new SupportError('configuration')
  return url.toString().replace(/\/$/, '')
}

function summary(value: unknown): value is ConversationSummary {
  return record(value) && nonEmpty(value.id) && typeof value.subject === 'string'
    && nonEmpty(value.status) && nonEmpty(value.customer_id) && nonEmpty(value.updated_at)
    && Number.isSafeInteger(value.unread_count) && (value.unread_count as number) >= 0
}

function session(value: unknown): value is CustomerSession {
  return record(value) && nonEmpty(value.token, 16384) && nonEmpty(value.expiresAt)
    && Number.isFinite(Date.parse(value.expiresAt)) && record(value.contact) && nonEmpty(value.contact.id)
}

function message(value: unknown): value is SupportMessage {
  return record(value) && nonEmpty(value.id) && nonEmpty(value.conversation_id) && typeof value.body === 'string'
    && (value.visibility === 'public' || value.visibility === 'internal') && nonEmpty(value.created_at)
}

function page(value: unknown): value is ConversationPage {
  return record(value) && Array.isArray(value.conversations) && value.conversations.every(summary)
    && (value.nextCursor === null || typeof value.nextCursor === 'string')
}

function statusCode(status: number): SupportErrorCode {
  if (status === 401) return 'unauthorized'
  if (status === 403) return 'forbidden'
  if (status === 404) return 'not_found'
  if (status === 409) return 'conflict'
  if (status === 429 || status === 402) return 'quota_exceeded'
  if (status === 400 || status === 422) return 'validation'
  return 'unavailable'
}

/** No automatic write retries: a timed-out request may already have committed. */
export function createSupportClient(options: SupportClientOptions): SupportClient {
  if (!nonEmpty(options.key, 4096) || !nonEmpty(options.project) || (options.readKey !== undefined && !nonEmpty(options.readKey, 4096)))
    throw new SupportError('configuration')
  const base = `${serviceUrl(options.url ?? 'https://hq.support')}/api/v1/projects/${encodeURIComponent(options.project)}`
  const fetcher = options.fetch ?? globalThis.fetch
  const timeoutMs = options.timeoutMs ?? 10000
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 120000)
    throw new SupportError('configuration')

  async function request<T>(path: string, check: (value: unknown) => value is T, input?: unknown, retryKey?: string, read = false): Promise<T> {
    const headers = new Headers({ Accept: 'application/json', Authorization: `Bearer ${read ? options.readKey ?? options.key : options.key}` })
    if (input !== undefined) headers.set('Content-Type', 'application/json')
    if (retryKey) headers.set('Idempotency-Key', retryKey)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetcher(`${base}${path}`, {
        method: input === undefined ? 'GET' : 'POST', headers, signal: controller.signal,
        body: input === undefined ? undefined : JSON.stringify(input), redirect: 'error',
      })
      if (!response.ok) {
        await response.body?.cancel()
        throw new SupportError(statusCode(response.status), response.status)
      }
      let value: unknown
      try { value = await response.json() }
      catch { throw new SupportError('bad_response', response.status) }
      if (!check(value)) throw new SupportError('bad_response', response.status)
      return value
    }
    catch (error) {
      if (error instanceof SupportError) throw error
      throw new SupportError(controller.signal.aborted ? 'timeout' : 'network')
    }
    finally { clearTimeout(timer) }
  }

  return {
    createSession(identity) {
      validate(identity.externalId)
      return request('/sessions', session, identity)
    },
    track(event) {
      validate(event.externalId)
      validate(event.event)
      validate(event.idempotencyKey)
      return request('/events', (value): value is { id: string, accepted: true } => record(value) && nonEmpty(value.id) && value.accepted === true, event, event.idempotencyKey)
    },
    conversations: {
      create(input) {
        validate(input.externalId)
        validate(input.subject)
        validate(input.body, 20000)
        validate(input.idempotencyKey)
        return request('/conversations', (value): value is { conversation: ConversationSummary } => record(value) && summary(value.conversation), input, input.idempotencyKey)
      },
      reply(id, input) {
        validate(id)
        validate(input.body, 20000)
        validate(input.idempotencyKey)
        if (!['public', 'internal'].includes(input.visibility)) throw new SupportError('validation')
        return request(`/conversations/${encodeURIComponent(id)}/messages`, (value): value is { message: SupportMessage } => record(value) && message(value.message), input, input.idempotencyKey)
      },
      list(query = {}) {
        const params = new URLSearchParams()
        if (query.cursor !== undefined) { validate(query.cursor, 2048); params.set('cursor', query.cursor) }
        if (query.status !== undefined) { validate(query.status); params.set('status', query.status) }
        if (query.limit !== undefined) {
          if (!Number.isSafeInteger(query.limit) || query.limit < 1 || query.limit > 100) throw new SupportError('validation')
          params.set('limit', String(query.limit))
        }
        return request(`/conversations${params.size ? `?${params}` : ''}`, page, undefined, undefined, true)
      },
    },
  }
}

export interface AuthenticatedSupportRequest {
  user: () => Promise<{ id: number | string, email?: unknown, name?: unknown } | null | undefined>
}

/** Identity is read from the authenticated server request, never a submitted user ID. */
export async function createAuthenticatedSupportSession(client: Pick<SupportClient, 'createSession'>, request: AuthenticatedSupportRequest, options: {
  expose?: readonly ('email' | 'name')[]
  /** Resolve a tenant from authorized server context, not an unchecked request parameter. */
  resolveTenant?: (request: AuthenticatedSupportRequest) => string | number | Promise<string | number>
} = {}): Promise<CustomerSession> {
  const user = await request.user()
  if (!user || !['string', 'number'].includes(typeof user.id) || (typeof user.id === 'number' && !Number.isSafeInteger(user.id)) || !String(user.id).trim()) throw new SupportError('unauthorized', 401)
  let externalId = `user:${String(user.id)}`
  if (options.resolveTenant) {
    const tenant = await options.resolveTenant(request)
    if (!['string', 'number'].includes(typeof tenant) || (typeof tenant === 'number' && !Number.isSafeInteger(tenant)) || !String(tenant).trim()) throw new SupportError('forbidden', 403)
    externalId = `tenant:${encodeURIComponent(String(tenant))}:user:${encodeURIComponent(String(user.id))}`
  }
  const identity = { externalId, ...(options.expose?.includes('email') && typeof user.email === 'string' ? { email: user.email } : {}), ...(options.expose?.includes('name') && typeof user.name === 'string' ? { name: user.name } : {}) }
  return await client.createSession(identity)
}
