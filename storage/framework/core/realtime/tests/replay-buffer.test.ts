import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import {
  debugSnapshot,
  getReplayBuffer,
  pruneExpired,
  recordBroadcast,
  replaySince,
  setReplayBuffer,
} from '../src/replay-buffer'

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
