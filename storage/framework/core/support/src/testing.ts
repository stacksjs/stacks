import type { ConversationSummary, SupportFetch, SupportMessage } from './types'

export interface FakeSupportOptions {
  project?: string
  key?: string
  readKey?: string
  now?: () => Date
}

export interface FakeSupportService {
  project: string
  key: string
  readKey: string
  fetch: SupportFetch
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const row = value as Record<string, unknown>
    return `{${Object.keys(row).sort().map(key => `${JSON.stringify(key)}:${canonical(row[key])}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

/** Test-only HTTP adapter. No port, database or global fetch replacement. */
export function createFakeSupportService(options: FakeSupportOptions = {}): FakeSupportService {
  const project = options.project ?? 'test-project'
  const key = options.key ?? 'test-server-key'
  const readKey = options.readKey ?? 'test-read-key'
  const now = options.now ?? (() => new Date())
  const contacts = new Map<string, { id: string, externalId: string }>()
  const conversations = new Map<string, ConversationSummary>()
  const retry = new Map<string, { body: string, answer: unknown }>()
  let sequence = 0
  const next = (kind: string): string => `${kind}-${++sequence}`

  const fetch: SupportFetch = async (input, init) => {
    const request = new Request(input, init)
    const url = new URL(request.url)
    const prefix = `/api/v1/projects/${encodeURIComponent(project)}`
    if (!url.pathname.startsWith(`${prefix}/`)) return Response.json({ code: 'not_found' }, { status: 404 })
    const auth = request.headers.get('Authorization')
    const read = request.method === 'GET'
    if (auth !== `Bearer ${key}` && !(read && auth === `Bearer ${readKey}`))
      return Response.json({ code: 'unauthorized' }, { status: 401 })
    const path = url.pathname.slice(prefix.length)
    if (read && path === '/conversations') {
      const rows = [...conversations.values()].filter(row => !url.searchParams.get('status') || row.status === url.searchParams.get('status'))
      return Response.json({ conversations: rows.slice(0, Number(url.searchParams.get('limit') ?? 100)), nextCursor: null })
    }
    if (request.method !== 'POST') return Response.json({ code: 'not_found' }, { status: 404 })
    let body: Record<string, unknown>
    try { body = await request.json() }
    catch { return Response.json({ code: 'validation' }, { status: 422 }) }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return Response.json({ code: 'validation' }, { status: 422 })
    if (path === '/sessions') {
      if (typeof body.externalId !== 'string') return Response.json({ code: 'validation' }, { status: 422 })
      let contact = contacts.get(body.externalId)
      if (!contact) { contact = { id: next('contact'), externalId: body.externalId }; contacts.set(body.externalId, contact) }
      return Response.json({ token: next('session'), expiresAt: new Date(now().getTime() + 900000).toISOString(), contact })
    }
    const retryKey = request.headers.get('Idempotency-Key')
    if (!retryKey) return Response.json({ code: 'validation' }, { status: 422 })
    const scopedKey = `${path}:${retryKey}`
    const fingerprint = canonical(body)
    const prior = retry.get(scopedKey)
    if (prior) return prior.body === fingerprint ? Response.json(prior.answer) : Response.json({ code: 'conflict' }, { status: 409 })
    let answer: unknown
    if (path === '/events') {
      answer = { id: next('event'), accepted: true }
    }
    else if (path === '/conversations') {
      if (typeof body.externalId !== 'string' || typeof body.subject !== 'string') return Response.json({ code: 'validation' }, { status: 422 })
      const contact = contacts.get(body.externalId)
      if (!contact) return Response.json({ code: 'not_found' }, { status: 404 })
      const conversation: ConversationSummary = { id: next('conversation'), subject: body.subject, status: 'open', customer_id: contact.id, updated_at: now().toISOString(), unread_count: 1 }
      conversations.set(conversation.id, conversation)
      answer = { conversation }
    }
    else {
      const match = path.match(/^\/conversations\/([^/]+)\/messages$/)
      if (!match || !conversations.has(decodeURIComponent(match[1]!))) return Response.json({ code: 'not_found' }, { status: 404 })
      if (typeof body.body !== 'string' || !['public', 'internal'].includes(String(body.visibility))) return Response.json({ code: 'validation' }, { status: 422 })
      const message: SupportMessage = { id: next('message'), conversation_id: decodeURIComponent(match[1]!), body: body.body, visibility: body.visibility as 'public' | 'internal', created_at: now().toISOString() }
      answer = { message }
    }
    retry.set(scopedKey, { body: fingerprint, answer })
    return Response.json(answer, { status: 201 })
  }
  return { project, key, readKey, fetch }
}
