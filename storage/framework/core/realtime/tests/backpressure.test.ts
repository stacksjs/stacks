import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { Broadcast, getBackpressureGuard, setBackpressureGuard } from '../src/broadcast'
import { setServer } from '../src/server-instance'

// stacksjs/stacks#1877 R-2 — pins the opt-in backpressure guard
// contract. The guard runs INSIDE the broadcast wrapper before the
// underlying ts-broadcasting server.broadcast() call; sockets with
// `backpressure > threshold` trigger the configured `onSlow`.

describe('Backpressure guard (stacksjs/stacks#1877 R-2)', () => {
  beforeEach(() => {
    setBackpressureGuard(null)
  })

  afterEach(() => {
    setBackpressureGuard(null)
  })

  test('default is no guard installed (backwards-compat)', () => {
    expect(getBackpressureGuard()).toBeNull()
  })

  test('installs a guard with default threshold (1 MiB)', () => {
    setBackpressureGuard({})
    const cfg = getBackpressureGuard()
    expect(cfg).not.toBeNull()
    expect(cfg!.maxPerSocketBytes).toBe(1024 * 1024)
    expect(typeof cfg!.onSlow).toBe('function')
  })

  test('honors custom threshold and onSlow handler', () => {
    const calls: Array<{ channelName: string, backpressure: number }> = []
    setBackpressureGuard({
      maxPerSocketBytes: 512,
      onSlow: ({ channelName, backpressure }) => {
        calls.push({ channelName, backpressure })
      },
    })

    // Simulate a broadcast tick: server with one slow socket on
    // 'orders' (1024 bytes pending, above 512 threshold).
    const slowSocket = { backpressure: 1024 }
    const fastSocket = { backpressure: 100 }
    setServer({
      start: async () => {},
      stop: async () => {},
      hasSubscribers: () => true,
      channels: new Map([['orders', new Set([slowSocket, fastSocket])]]),
      broadcast() {},
    } as any)

    new Broadcast().broadcast('orders', 'updated', { id: 1 })

    expect(calls).toHaveLength(1)
    expect(calls[0]).toEqual({ channelName: 'orders', backpressure: 1024 })
  })

  test('skips sockets without a numeric .backpressure field', () => {
    const calls: unknown[] = []
    setBackpressureGuard({
      maxPerSocketBytes: 1,
      onSlow: info => calls.push(info),
    })

    // Sockets without backpressure (e.g. mocked or non-Bun) should
    // never trigger onSlow even with a tiny threshold.
    setServer({
      start: async () => {},
      stop: async () => {},
      hasSubscribers: () => true,
      channels: new Map([['x', new Set([{}, { backpressure: 'oops' }])]]),
      broadcast() {},
    } as any)

    new Broadcast().broadcast('x', 'event', {})
    expect(calls).toHaveLength(0)
  })

  test('clearing the guard restores no-op behavior', () => {
    setBackpressureGuard({ maxPerSocketBytes: 1 })
    expect(getBackpressureGuard()).not.toBeNull()
    setBackpressureGuard(null)
    expect(getBackpressureGuard()).toBeNull()
  })
})
