import { describe, expect, test } from 'bun:test'
import { createFakeHqService } from '../../testing/src/hq'
import { createHqClient } from '../src/client'

const row = { id: 'c1', subject: 'Help with billing', status: 'open', customer_id: 'customer1', updated_at: '2026-11-13T10:00:00.000Z', unread_count: 2 }

describe('HQ.support reader', () => {
  test('reads project summaries, filters and paginates with a read key', async () => {
    const service = createFakeHqService({ service: 'supporthq' })
    const grant = service.project()
    service.seedConversation({ ...row, project: grant.project.id })
    service.seedConversation({ ...row, id: 'c2', updated_at: '2026-11-12T10:00:00.000Z', project: grant.project.id })
    service.seedConversation({ ...row, id: 'other-project', project: service.project('other').project.id })
    const client = createHqClient({ services: { supporthq: { url: service.origin, readKey: grant.readKey, project: grant.project.id } }, fetch: service.fetch })
    const page = await client.support.conversations({ status: 'open', limit: 1 })
    expect(page).toEqual({ ok: true, data: { conversations: [{ id: 'c1', subject: row.subject, status: 'open', customerId: 'customer1', updatedAt: row.updated_at, unreadCount: 2 }], nextCursor: row.updated_at } })
    const second = await client.support.conversations({ before: row.updated_at })
    expect(second.ok && second.data.conversations.map(item => item.id)).toEqual(['c2'])
  })

  test('refuses ingest keys and keys from other projects', async () => {
    const service = createFakeHqService({ service: 'supporthq' })
    const grant = service.project()
    for (const readKey of [grant.ingestKey, service.project('other').readKey]) {
      const client = createHqClient({ services: { supporthq: { url: service.origin, project: grant.project.id, readKey } }, fetch: service.fetch })
      expect(await client.support.conversations()).toMatchObject({ ok: false, service: 'supporthq', reason: 'http', status: 404 })
    }
  })

  test('escapes project identifiers and sends only the read key', async () => {
    let target = ''
    const client = createHqClient({ services: { supporthq: { url: 'https://hq.support/', readKey: 'read-only', project: 'p/1 ?' } }, fetch: async (url, init) => {
      target = url
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer read-only')
      return Response.json({ conversations: [], nextCursor: null })
    } })
    expect((await client.support.conversations({ status: 'open', limit: 10 })).ok).toBe(true)
    expect(target).toBe('https://hq.support/api/v1/projects/p%2F1%20%3F/conversations?status=open&limit=10')
  })

  test('missing config, malformed rows and invalid cursors are typed failures', async () => {
    expect(await createHqClient({ services: {} }).support.conversations()).toMatchObject({ reason: 'not_configured' })
    const config = { supporthq: { url: 'https://hq.support', readKey: 'read', project: 'p' } }
    for (const body of [
      { conversations: [{ ...row, unread_count: -1 }], nextCursor: null },
      { conversations: [{ ...row, updated_at: 'invalid' }], nextCursor: null },
      { conversations: [row], nextCursor: 123 },
      { conversations: [row] },
    ]) {
      const result = await createHqClient({ services: config, fetch: async () => Response.json(body) }).support.conversations()
      expect(result).toMatchObject({ ok: false, reason: 'bad_response' })
    }
  })
})
