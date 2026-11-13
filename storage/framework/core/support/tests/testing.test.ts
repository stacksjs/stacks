import { expect, test } from 'bun:test'
import { createSupportClient } from '../src/server'
import { createFakeSupportService } from '../src/testing'

test('the same public client exercises session, event and idempotent conversation flows against the fake', async () => {
  const fake = createFakeSupportService()
  const support = createSupportClient({ key: fake.key, readKey: fake.readKey, project: fake.project, fetch: fake.fetch })
  const session = await support.createSession({ externalId: 'customer-1', name: 'Alex' })
  expect(session.contact.externalId).toBe('customer-1')
  const input = { externalId: 'customer-1', subject: 'Delivery question', body: 'Where is order 5?', idempotencyKey: 'new-thread' }
  const first = await support.conversations.create(input)
  expect(await support.conversations.create(input)).toEqual(first)
  await expect(support.conversations.create({ ...input, body: 'Different question' })).rejects.toMatchObject({ code: 'conflict' })
  expect((await support.conversations.list()).conversations).toHaveLength(1)
  const reply = await support.conversations.reply(first.conversation.id, { body: 'Investigating', visibility: 'internal', idempotencyKey: 'reply-1' })
  expect(reply.message.visibility).toBe('internal')
  const event = { externalId: 'customer-1', event: 'order.viewed', idempotencyKey: 'event-1' }
  expect(await support.track(event)).toEqual(await support.track(event))
})

test('read credentials cannot write and foreign projects cannot read', async () => {
  const fake = createFakeSupportService()
  const reader = createSupportClient({ key: fake.readKey, project: fake.project, fetch: fake.fetch })
  await expect(reader.createSession({ externalId: 'forged' })).rejects.toMatchObject({ code: 'unauthorized' })
  const other = createSupportClient({ key: fake.key, project: 'foreign-project', fetch: fake.fetch })
  await expect(other.conversations.list()).rejects.toMatchObject({ code: 'not_found' })
})
