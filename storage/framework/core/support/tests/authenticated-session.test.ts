import { expect, test } from 'bun:test'
import { createAuthenticatedSupportSession, createSupportClient } from '../src/server'
import { createFakeSupportService } from '../src/testing'

test('native request identity ignores browser impersonation and exposes attributes only when selected', async () => {
  const service = createFakeSupportService(), sent: unknown[] = []
  const client = createSupportClient({ project: service.project, key: service.key, fetch: async (input, init) => { sent.push(JSON.parse(String(init?.body))); return await service.fetch(input, init) } })
  const request = { user: async () => ({ id: 12, email: 'private@example.test', name: 'Private name' }), all: () => ({ externalId: 'another-customer', userId: 999 }) }
  await createAuthenticatedSupportSession(client, request)
  expect(sent[0]).toEqual({ externalId: 'user:12' })
  await createAuthenticatedSupportSession(client, request, { expose: ['name'], resolveTenant: () => 'authorized-workspace' })
  expect(sent[1]).toEqual({ externalId: 'tenant:authorized-workspace:user:12', name: 'Private name' })
  await expect(createAuthenticatedSupportSession(client, { user: async () => null })).rejects.toMatchObject({ code: 'unauthorized' })
  expect(sent).toHaveLength(2)
})
