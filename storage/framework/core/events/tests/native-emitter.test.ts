/**
 * Coverage for the native Stacks emitter additions on top of the legacy
 * mitt-style API:
 *   - createEmitter() factory
 *   - once() auto-removal
 *   - removeAllListeners() targeted + global
 *   - listenerCount()
 *   - emitAsync() awaits handlers + returns their results
 *   - mitt() backward-compat alias
 *
 * Wildcard / pattern / off / handler-error semantics live in the existing
 * test files so we don't re-cover them here.
 */

import { describe, expect, test } from 'bun:test'
import { createEmitter, mitt } from '../src'

describe('createEmitter (native Stacks emitter)', () => {
  test('createEmitter and the legacy mitt alias produce the same shape', () => {
    const a = createEmitter()
    const b = mitt()
    for (const k of ['on', 'once', 'off', 'emit', 'emitAsync', 'removeAllListeners', 'listenerCount']) {
      expect(typeof (a as any)[k]).toBe('function')
      expect(typeof (b as any)[k]).toBe('function')
    }
  })

  test('once() auto-removes after first invocation', () => {
    const bus = createEmitter<{ ping: number }>()
    const calls: number[] = []
    bus.once('ping', n => calls.push(n))

    bus.emit('ping', 1)
    bus.emit('ping', 2)
    bus.emit('ping', 3)

    expect(calls).toEqual([1])
    expect(bus.listenerCount('ping')).toBe(0)
  })

  test('once() with off(handler) removes by the original handler reference', () => {
    const bus = createEmitter<{ ping: number }>()
    const calls: number[] = []
    const handler = (n: number) => calls.push(n)
    bus.once('ping', handler)
    expect(bus.listenerCount('ping')).toBe(1)

    bus.off('ping', handler)
    bus.emit('ping', 99)
    expect(calls).toEqual([])
    expect(bus.listenerCount('ping')).toBe(0)
  })

  test('listenerCount counts only exact-type registrations', () => {
    const bus = createEmitter<{ a: void, b: void }>()
    bus.on('a', () => {})
    bus.on('a', () => {})
    bus.on('b', () => {})
    bus.on('*' as any, () => {})

    expect(bus.listenerCount('a')).toBe(2)
    expect(bus.listenerCount('b')).toBe(1)
    expect(bus.listenerCount('*' as any)).toBe(1)
  })

  test('removeAllListeners() with a type clears just that bucket', () => {
    const bus = createEmitter<{ a: void, b: void }>()
    bus.on('a', () => {})
    bus.on('a', () => {})
    bus.on('b', () => {})

    bus.removeAllListeners('a')
    expect(bus.listenerCount('a')).toBe(0)
    expect(bus.listenerCount('b')).toBe(1)
  })

  test('removeAllListeners() with no args clears the whole bus', () => {
    const bus = createEmitter<{ a: void, b: void }>()
    bus.on('a', () => {})
    bus.on('b', () => {})
    bus.on('*' as any, () => {})

    bus.removeAllListeners()
    expect(bus.listenerCount('a')).toBe(0)
    expect(bus.listenerCount('b')).toBe(0)
    expect(bus.listenerCount('*' as any)).toBe(0)
  })

  test('emitAsync awaits every handler and returns their results in order', async () => {
    const bus = createEmitter<{ work: number }>()
    bus.on('work', async (n) => {
      await new Promise(r => setTimeout(r, 5))
      return n * 2 as any
    })
    bus.on('work', n => n + 1 as any)

    const results = await bus.emitAsync('work', 10)
    expect(results).toEqual([20, 11])
  })

  test('emitAsync runs pattern handlers + wildcard handlers too', async () => {
    const bus = createEmitter<{ 'user:created': { id: number } }>()
    const order: string[] = []
    bus.on('user:created', () => { order.push('exact') })
    bus.on('user:*' as any, () => { order.push('pattern') })
    bus.on('*' as any, () => { order.push('wildcard') })

    await bus.emitAsync('user:created', { id: 1 })
    expect(order).toEqual(['exact', 'pattern', 'wildcard'])
  })

  test('emitAsync surfaces handler errors as undefined slots, never throws', async () => {
    const bus = createEmitter<{ work: number }>()
    bus.on('work', () => { throw new Error('boom') })
    bus.on('work', () => 'ok' as any)

    const results = await bus.emitAsync('work', 1)
    // First handler threw → undefined slot. Second still executed.
    expect(results.length).toBe(2)
    expect(results[1]).toBe('ok')
  })

  test('handler that mutates the map mid-emit (e.g. once) does not break iteration', () => {
    const bus = createEmitter<{ ping: void }>()
    let count = 0
    bus.on('ping', () => { count++; bus.removeAllListeners('ping') })
    bus.on('ping', () => { count++ }) // would-be removed, but the snapshot was taken first

    bus.emit('ping', undefined as any)
    // Iterating over the snapshot means the second handler still fires.
    expect(count).toBe(2)
    // After the emit completes the bucket is empty.
    expect(bus.listenerCount('ping')).toBe(0)
  })
})
