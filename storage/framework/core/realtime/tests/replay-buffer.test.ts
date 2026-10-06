import type { BroadcastEvent } from 'ts-broadcasting'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { Broadcast, broadcast } from 'ts-broadcasting'
import { Broadcast as LegacyBroadcast } from '../src/broadcast'
import { channel } from '../src/channel'
import { emit } from '../src/emit'
import {
  debugSnapshot,
  getReplayBuffer,
  pruneExpired,
  recordBroadcast,
  replaySince,
  setReplayBuffer,
} from '../src/replay-buffer'
import { createServer, getServer, stopServer } from '../src/server-instance'
import { randomPort, settle, subscriber } from './fixtures/realtime'

// stacksjs/stacks#1877 R-3 — pins the at-least-once replay contract:
// - opt-in (default off, no buffering)
// - monotonic per-channel seq IDs
// - FIFO eviction past maxPerChannel
// - TTL eviction (lazy on read; eager via pruneExpired)
// - glob-ish channel patterns

describe('Replay buffer (stacksjs/stacks#1877 R-3)', () => {
  beforeEach(() => {
    setReplayBuffer(null)
  })

  afterEach(() => {
    setReplayBuffer(null)
  })

  test('default is off (no buffer installed)', () => {
    expect(getReplayBuffer()).toBeNull()
    expect(recordBroadcast('orders', 'created', { id: 1 })).toBeNull()
    expect(replaySince('orders', 0)).toEqual([])
  })

  test('recordBroadcast assigns monotonic per-channel seq IDs', () => {
    setReplayBuffer({ channels: ['*'] })

    expect(recordBroadcast('orders', 'created', { id: 1 })).toBe(1)
    expect(recordBroadcast('orders', 'updated', { id: 1 })).toBe(2)
    expect(recordBroadcast('orders', 'deleted', { id: 1 })).toBe(3)

    // Different channel → independent seq counter.
    expect(recordBroadcast('users', 'created', { id: 5 })).toBe(1)
    expect(recordBroadcast('users', 'updated', { id: 5 })).toBe(2)
  })

  test('replaySince returns only messages with seq > sinceSeq', () => {
    setReplayBuffer({ channels: ['*'] })

    recordBroadcast('orders', 'a', { i: 1 })
    recordBroadcast('orders', 'b', { i: 2 })
    recordBroadcast('orders', 'c', { i: 3 })

    expect(replaySince('orders', 0).map(m => m.event)).toEqual(['a', 'b', 'c'])
    expect(replaySince('orders', 1).map(m => m.event)).toEqual(['b', 'c'])
    expect(replaySince('orders', 3).map(m => m.event)).toEqual([])
  })

  test('FIFO eviction past maxPerChannel', () => {
    setReplayBuffer({ channels: ['*'], maxPerChannel: 3 })

    for (let i = 1; i <= 5; i++)
      recordBroadcast('chan', `evt-${i}`, { i })

    const all = replaySince('chan', 0)
    expect(all.map(m => m.event)).toEqual(['evt-3', 'evt-4', 'evt-5'])
  })

  test('TTL eviction (lazy on read)', async () => {
    setReplayBuffer({ channels: ['*'], ttlMs: 50 })
    recordBroadcast('chan', 'old', {})
    await new Promise(r => setTimeout(r, 80))
    recordBroadcast('chan', 'fresh', {})

    // 'old' is past its TTL — replaySince should evict it on the way through.
    const after = replaySince('chan', 0)
    expect(after.map(m => m.event)).toEqual(['fresh'])
  })

  test('pruneExpired drops stale entries across channels', async () => {
    setReplayBuffer({ channels: ['*'], ttlMs: 50 })
    recordBroadcast('a', 'old1', {})
    recordBroadcast('b', 'old2', {})
    await new Promise(r => setTimeout(r, 80))

    pruneExpired()
    const snap = debugSnapshot()
    expect(snap.a?.count).toBe(0)
    expect(snap.b?.count).toBe(0)
  })

  test('glob-ish channel matching: * matches all', () => {
    setReplayBuffer({ channels: ['*'] })
    expect(recordBroadcast('orders', 'x', {})).toBe(1)
    expect(recordBroadcast('private-users', 'x', {})).toBe(1)
  })

  test('glob-ish channel matching: prefix.* matches matching prefix', () => {
    setReplayBuffer({ channels: ['orders.*'] })
    expect(recordBroadcast('orders.created', 'x', {})).toBe(1)
    expect(recordBroadcast('orders.updated', 'x', {})).toBe(1)
    expect(recordBroadcast('users.created', 'x', {})).toBeNull()
  })

  test('a pattern matches a private-/presence- channel by its unprefixed name', () => {
    setReplayBuffer({ channels: ['orders.*', 'lobby'] })
    expect(recordBroadcast('private-orders.1', 'x', {})).toBe(1)
    expect(recordBroadcast('presence-orders.1', 'x', {})).toBe(1)
    expect(recordBroadcast('presence-lobby', 'x', {})).toBe(1)
    expect(recordBroadcast('private-users.1', 'x', {})).toBeNull()
    // Recorded under the full name clients subscribe to.
    expect(replaySince('private-orders.1', 0)).toHaveLength(1)
    expect(replaySince('orders.1', 0)).toEqual([])
  })

  test('explicit literal match', () => {
    setReplayBuffer({ channels: ['critical-feed'] })
    expect(recordBroadcast('critical-feed', 'x', {})).toBe(1)
    expect(recordBroadcast('other-feed', 'x', {})).toBeNull()
  })

  test('clearing config drops all buffered state', () => {
    setReplayBuffer({ channels: ['*'] })
    recordBroadcast('chan', 'x', {})
    expect(replaySince('chan', 0)).toHaveLength(1)

    setReplayBuffer(null)
    expect(getReplayBuffer()).toBeNull()
    expect(replaySince('chan', 0)).toEqual([])
  })

  test('debugSnapshot reflects current per-channel state', () => {
    setReplayBuffer({ channels: ['*'], maxPerChannel: 5 })
    recordBroadcast('a', 'e1', {})
    recordBroadcast('a', 'e2', {})
    recordBroadcast('b', 'e1', {})

    const snap = debugSnapshot()
    expect(snap.a).toEqual({ count: 2, firstSeq: 1, lastSeq: 2 })
    expect(snap.b).toEqual({ count: 1, firstSeq: 1, lastSeq: 1 })
  })
})

// Against a started server: every broadcast API records, and the sequence
// number reaches the client. Only the legacy Broadcast class used to call
// recordBroadcast(), and the seq it returned was never sent anywhere, so a
// client had nothing to hand back to replaySince().
describe('replay buffer on a running server', () => {
  const port = randomPort()

  beforeAll(async () => {
    await createServer({ host: '127.0.0.1', port })
    Broadcast.channel('private-orders.{id}', () => true)
  })

  afterAll(async () => {
    await stopServer()
  })

  beforeEach(() => {
    setReplayBuffer({ channels: ['orders.*'] })
  })

  afterEach(() => {
    setReplayBuffer(null)
  })

  test('every broadcast API records the message and sends its seq to the client', async () => {
    const sub = await subscriber(port, 'private-orders.1')

    emit('orders.1', 'emitted', { n: 1 }, { private: true })
    await channel('orders.1').private('channelled', { n: 2 })
    broadcast('private-orders.1', 'facaded', { n: 3 })
    new LegacyBroadcast().broadcast('orders.1', 'legacy', { n: 4 }, 'private')
    // runBroadcast() sends a broadcast file's event through the broadcaster.
    const event: BroadcastEvent = {
      shouldBroadcast: () => true,
      broadcastOn: () => 'private-orders.1',
      broadcastAs: () => 'from-file',
      broadcastWith: () => ({ n: 5 }),
    }
    await getServer()!.broadcaster.broadcast(event)
    await settle()

    expect(sub.inbox).toEqual([
      { seq: 1, event: 'emitted', channel: 'private-orders.1', data: { n: 1 } },
      { seq: 2, event: 'channelled', channel: 'private-orders.1', data: { n: 2 } },
      { seq: 3, event: 'facaded', channel: 'private-orders.1', data: { n: 3 } },
      { seq: 4, event: 'legacy', channel: 'private-orders.1', data: { n: 4 } },
      { seq: 5, event: 'from-file', channel: 'private-orders.1', data: { n: 5 } },
    ])

    // What the client last saw drives the replay.
    const lastSeen = sub.inbox[2].seq
    expect(replaySince('private-orders.1', lastSeen).map(m => m.event)).toEqual(['legacy', 'from-file'])
    sub.socket.close()
  })

  test('a message sent while nobody is subscribed is still recorded for replay', async () => {
    emit('orders.2', 'while-away', { n: 1 }, { private: true })

    const sub = await subscriber(port, 'private-orders.2')
    expect(replaySince('private-orders.2', 0).map(m => ({ seq: m.seq, event: m.event }))).toEqual([{ seq: 1, event: 'while-away' }])

    emit('orders.2', 'back', {}, { private: true })
    await settle()
    expect(sub.inbox).toEqual([{ seq: 2, event: 'back', channel: 'private-orders.2', data: {} }])
    sub.socket.close()
  })

  test('a channel no pattern covers carries no seq', async () => {
    const sub = await subscriber(port, 'news')
    emit('news', 'posted', { id: 1 })
    await settle()
    expect(sub.inbox).toEqual([{ event: 'posted', channel: 'news', data: { id: 1 } }])
    sub.socket.close()
  })
})
