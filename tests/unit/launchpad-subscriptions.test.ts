import { expect, test } from 'bun:test'
import { subscribeToLaunchpad } from '../../app/Services/launchpad-subscriptions'

function fixture() {
  const memberships = new Map<string, { token: string, email: string, listId: number }>()
  const calls: string[] = []
  const list = { id: 42, slug: 'launchpad-updates', name: 'Launchpad updates', update: async () => {} }
  let present = false
  const ports = {
    lists: {
      find: async () => present ? list : undefined,
      create: async () => { present = true; calls.push('list-created'); return list },
    },
    subscribe: async (email: string, options: { list?: string | number, source?: string } = {}) => {
      calls.push(`${email}:${options.list}:${options.source}`)
      const previous = memberships.get(email)
      if (previous) return { ...previous, created: false }
      const membership = { email, token: crypto.randomUUID(), listId: Number(options.list) }
      memberships.set(email, membership)
      return { ...membership, created: true }
    },
  }
  return { ports, calls, memberships }
}

test('existing Stacks addresses can independently join Launchpad with a stable list-specific unsubscribe token', async () => {
  const { ports, calls, memberships } = fixture()
  const first = await subscribeToLaunchpad(' Person@Example.com ', ports)
  const repeat = await subscribeToLaunchpad('person@example.com', ports)
  expect(first.created).toBe(true)
  expect(repeat.created).toBe(false)
  expect(repeat.token).toBe(first.token)
  expect(memberships.size).toBe(1)
  expect(calls).toEqual(['list-created', 'person@example.com:42:launchpad', 'person@example.com:42:launchpad'])
})

test('invalid addresses are refused before any model or provider work', async () => {
  const { ports, calls } = fixture()
  for (const email of ['', 'missing-domain@', 'bad address@example.com', `${'a'.repeat(256)}@example.com`]) await expect(subscribeToLaunchpad(email, ports)).rejects.toThrow('valid email')
  expect(calls).toEqual([])
})

test('list creation races reuse the winner but database outages remain errors', async () => {
  const { ports } = fixture()
  const list = await ports.lists.create()
  let reads = 0
  const raced = { ...ports, lists: { find: async () => ++reads === 1 ? undefined : list, create: async () => { throw new Error('unique list slug') } } }
  expect((await subscribeToLaunchpad('person@example.com', raced)).listId).toBe(42)
  await expect(subscribeToLaunchpad('person@example.com', { ...ports, lists: { find: async () => undefined, create: async () => { throw new Error('database unavailable') } } })).rejects.toThrow('database unavailable')
})
