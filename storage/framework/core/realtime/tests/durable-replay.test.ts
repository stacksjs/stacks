import { describe, expect, test } from 'bun:test'
import { createMemoryDurableReplayStore } from '../src/durable-replay'

// Public store contract catches cursor/idempotency semantics; actual SQL and
// independent workers are qualified separately, never replaced by this fake.
describe('durable replay contract', () => {
  test('a retained operation has one immutable sequence and JSON snapshot', async () => {
    const store = createMemoryDurableReplayStore({ clock: () => 1000, incarnation: () => '00000000-0000-4000-8000-000000000001' })
    const data = { name: 'before' }
    const first = await store.append({ channel: 'private-orders.1', event: 'created', data, idempotencyKey: 'operation-1' })
    data.name = 'after'
    const duplicate = await store.append({ channel: 'private-orders.1', event: 'created', data: { name: 'before' }, idempotencyKey: 'operation-1' })
    expect(first.message.seq).toBe(1)
    expect(duplicate.duplicate).toBe(true)
    expect(duplicate.message).toEqual(first.message)
    const page = await store.replay({ channel: 'private-orders.1', after: null })
    expect(page.messages).toEqual([{ seq: 1, ts: 1000, event: 'created', data: { name: 'before' } }])
    expect(page.gap).toBeNull()
    expect(page.cursor).toEqual({ incarnation: '00000000-0000-4000-8000-000000000001', seq: 1 })
    await expect(store.append({ channel: 'private-orders.1', event: 'created', data: { changed: true }, idempotencyKey: 'operation-1' })).rejects.toMatchObject({ code: 'replay_idempotency_conflict' })
  })
})

test('retention, response bytes and malformed JSON cannot silently advance a cursor', async () => {
  let now = 1000
  const store = createMemoryDurableReplayStore({ clock: () => now, maxEvents: 2, ttlMs: 10, maxPayloadBytes: 500, maxReplayBytes: 1012 })
  const a = await store.append({ channel: 'orders', event: 'a', data: { b: 2, a: 1 }, idempotencyKey: 'a' })
  expect((await store.append({ channel: 'orders', event: 'a', data: { a: 1, b: 2 }, idempotencyKey: 'a' })).duplicate).toBe(true)
  await store.append({ channel: 'orders', event: 'b', data: 'b'.repeat(490), idempotencyKey: 'b' })
  await store.append({ channel: 'orders', event: 'c', data: 'c'.repeat(490), idempotencyKey: 'c' })
  expect((await store.replay({ channel: 'orders', after: null })).gap).toBe('retention')
  const firstPage = await store.replay({ channel: 'orders', after: a.cursor })
  expect(firstPage.messages.map(message => message.seq)).toEqual([2]); expect(firstPage.hasMore).toBe(true)
  const secondPage = await store.replay({ channel: 'orders', after: firstPage.cursor })
  expect(secondPage.messages.map(message => message.seq)).toEqual([3]); expect(secondPage.hasMore).toBe(false)
  now = 1010
  expect((await store.replay({ channel: 'orders', after: firstPage.cursor })).gap).toBe('retention')
  expect((await store.prune('orders')).prunedThrough).toBe(3)
  for (const data of [Infinity, { nested: undefined }, 1n, { bad: () => true }, new Date(), 'large'.repeat(1000)]) await expect(store.append({ channel: 'orders', event: 'a', data, idempotencyKey: 'bad' })).rejects.toThrow()
  await expect(store.replay({ channel: 'orders', after: { ...a.cursor, seq: true } as any })).rejects.toThrow()
  await expect(store.replay({ channel: 'orders', after: { ...a.cursor, seq: [1] } as any })).rejects.toThrow()
  const cycle: Record<string, unknown> = {}; cycle.self = cycle
  await expect(store.append({ channel: 'orders', event: 'cycle', data: cycle, idempotencyKey: 'cycle' })).rejects.toThrow()
})
