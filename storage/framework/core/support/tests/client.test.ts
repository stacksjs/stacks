import { describe, expect, test } from 'bun:test'
import { createSupportClient, SupportError } from '../src/server'

describe('support server client', () => {
  test('creates a customer session with credentials confined to the server request', async () => {
    const requests: Request[] = []
    const client = createSupportClient({
      key: 'secret-server-key',
      project: 'project/one',
      fetch: async (input, init) => {
        requests.push(new Request(input, init))
        return Response.json({ token: 'customer-token', expiresAt: '2026-11-13T22:00:00Z', contact: { id: 'contact-1', externalId: 'user-1' } })
      },
    })
    const session = await client.createSession({ externalId: 'user-1', name: 'Customer' })
    expect(session.token).toBe('customer-token')
    expect(requests[0]!.url).toBe('https://hq.support/api/v1/projects/project%2Fone/sessions')
    expect(requests[0]!.headers.get('Authorization')).toBe('Bearer secret-server-key')
    expect(await requests[0]!.json()).toEqual({ externalId: 'user-1', name: 'Customer' })
  })

  test('uses read credentials for summaries and forwards opaque cursor values safely', async () => {
    const client = createSupportClient({ key: 'write', readKey: 'read', project: 'p', fetch: async (input, init) => {
      const request = new Request(input, init)
      expect(request.headers.get('Authorization')).toBe('Bearer read')
      expect(new URL(request.url).searchParams.get('cursor')).toBe('a&status=resolved')
      return Response.json({ conversations: [{ id: 'c', subject: 'Help', status: 'open', customer_id: 'u', updated_at: '2026-11-13T00:00:00Z', unread_count: 1 }], nextCursor: null })
    } })
    expect((await client.conversations.list({ cursor: 'a&status=resolved' })).conversations[0]!.subject).toBe('Help')
  })

  test('sends idempotent writes once and surfaces quota errors without leaking response secrets', async () => {
    let attempts = 0
    const client = createSupportClient({ key: 'write', project: 'p', fetch: async (_input, init) => {
      attempts++
      expect(new Headers(init?.headers).get('Idempotency-Key')).toBe('request-1')
      return Response.json({ code: 'quota_exceeded', secret: 'must-never-escape' }, { status: 429 })
    } })
    try {
      await client.conversations.create({ externalId: 'u', subject: 'Help', body: 'Hi', idempotencyKey: 'request-1' })
      throw new Error('Expected failure')
    }
    catch (error) {
      expect(error).toBeInstanceOf(SupportError)
      expect((error as SupportError).code).toBe('quota_exceeded')
      expect((error as SupportError).status).toBe(429)
      expect(String(error)).not.toContain('must-never-escape')
    }
    expect(attempts).toBe(1)
  })

  test('rejects malformed successful responses and unsafe service URLs', async () => {
    expect(() => createSupportClient({ url: 'https://user:password@example.com', key: 'key', project: 'p' })).toThrow(SupportError)
    expect(() => createSupportClient({ url: 'http://example.com', key: 'key', project: 'p' })).toThrow(SupportError)
    const client = createSupportClient({ key: 'key', project: 'p', fetch: async () => Response.json({ token: 'incomplete' }) })
    await expect(client.createSession({ externalId: 'u' })).rejects.toMatchObject({ code: 'bad_response' })
  })

  test('classifies network failure without retrying a possibly completed write', async () => {
    const client = createSupportClient({ key: 'key', project: 'p', fetch: async () => { throw new Error('sensitive proxy configuration') } })
    await expect(client.track({ externalId: 'u', event: 'order.created', idempotencyKey: 'event-1' })).rejects.toMatchObject({ code: 'network', status: 0 })
  })
})
