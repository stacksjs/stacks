import { describe, expect, test } from 'bun:test'
import mitt, { dispatch, listen, off, events, emitter } from '../src/index'

describe('Events Integration', () => {
  describe('Basic emit and listen', () => {
    test('listen receives emitted event data', () => {
      const bus = mitt<{ ping: { msg: string } }>()
      let received = ''
      bus.on('ping', (evt) => { received = evt.msg })
      bus.emit('ping', { msg: 'hello' })
      expect(received).toBe('hello')
    })

    test('multiple handlers all fire', () => {
      const bus = mitt<{ tick: number }>()
      const results: number[] = []
      bus.on('tick', (n) => results.push(n * 1))
      bus.on('tick', (n) => results.push(n * 2))
      bus.on('tick', (n) => results.push(n * 3))
      bus.emit('tick', 10)
      expect(results).toEqual([10, 20, 30])
    })

    test('different event types are independent', () => {
      const bus = mitt<{ a: string, b: number }>()
      let aVal = ''
      let bVal = 0
      bus.on('a', (v) => { aVal = v })
      bus.on('b', (v) => { bVal = v })
      bus.emit('a', 'alpha')
      bus.emit('b', 42)
      expect(aVal).toBe('alpha')
      expect(bVal).toBe(42)
    })

    test('handler receives complex objects', () => {
      const bus = mitt<{ user: { name: string, roles: string[] } }>()
      let captured: { name: string, roles: string[] } | null = null
      bus.on('user', (data) => { captured = data })
      bus.emit('user', { name: 'Chris', roles: ['admin', 'user'] })
      expect(captured).toEqual({ name: 'Chris', roles: ['admin', 'user'] })
    })
  })

  describe('Off / unsubscribe', () => {
    test('off removes specific handler', () => {
      const bus = mitt<{ event: string }>()
      const calls: string[] = []
      const handler = (v: string) => calls.push(v)
      bus.on('event', handler)
      bus.emit('event', 'first')
      bus.off('event', handler)
      bus.emit('event', 'second')
      expect(calls).toEqual(['first'])
    })

    test('off without handler removes all handlers for type', () => {
      const bus = mitt<{ event: number }>()
      let count = 0
      bus.on('event', () => count++)
      bus.on('event', () => count++)
      bus.emit('event', 1)
      expect(count).toBe(2)
      bus.off('event')
      bus.emit('event', 2)
      expect(count).toBe(2) // no more calls
    })
  })

  describe('Wildcard handler', () => {
    test('wildcard * receives all events', () => {
      const bus = mitt<{ foo: string, bar: number }>()
      const captured: Array<[string, unknown]> = []
      bus.on('*', (type, evt) => captured.push([type as string, evt]))
      bus.emit('foo', 'hello')
      bus.emit('bar', 42)
      expect(captured.length).toBe(2)
      expect(captured[0]).toEqual(['foo', 'hello'])
      expect(captured[1]).toEqual(['bar', 42])
    })

    test('wildcard handler can be removed', () => {
      const bus = mitt<{ test: string }>()
      const calls: string[] = []
      const handler = (_type: string, evt: unknown) => calls.push(evt as string)
      bus.on('*', handler as any)
      bus.emit('test', 'a')
      bus.off('*', handler as any)
      bus.emit('test', 'b')
      expect(calls).toEqual(['a'])
    })
  })

  describe('Pattern matching (glob-like)', () => {
    test('user:* matches user:created and user:deleted', () => {
      const bus = mitt<Record<string, any>>()
      const matched: string[] = []
      bus.on('user:*' as any, (_type: string, evt: any) => matched.push(evt.action))
      bus.emit('user:created', { action: 'created' })
      bus.emit('user:deleted', { action: 'deleted' })
      bus.emit('order:created', { action: 'order' })
      expect(matched).toEqual(['created', 'deleted'])
    })

    test('*.created matches multiple namespaces', () => {
      const bus = mitt<Record<string, any>>()
      const matched: string[] = []
      bus.on('*.created' as any, (_type: string, evt: any) => matched.push(evt.entity))
      bus.emit('user.created', { entity: 'user' })
      bus.emit('post.created', { entity: 'post' })
      bus.emit('user.deleted', { entity: 'user-del' })
      expect(matched).toEqual(['user', 'post'])
    })
  })

  describe('Error isolation', () => {
    test('handler error does not break other handlers', () => {
      const bus = mitt<{ event: number }>()
      const results: number[] = []
      bus.on('event', () => { throw new Error('boom') })
      bus.on('event', (n) => results.push(n))
      // The second handler should still receive the event
      // even though the first throws (errors are caught and logged)
      bus.emit('event', 99)
      expect(results).toEqual([99])
    })

    test('pattern handler error does not break other pattern handlers', () => {
      const bus = mitt<Record<string, any>>()
      const results: string[] = []
      bus.on('test:*' as any, () => { throw new Error('pattern boom') })
      bus.on('*', (_type: string, evt: any) => results.push(evt.val))
      bus.emit('test:event', { val: 'ok' })
      expect(results).toEqual(['ok'])
    })
  })

  describe('Global event bus (pre-created instance)', () => {
    test('dispatch and listen work on global bus', () => {
      let received: Record<string, any> = {}
      listen('user:registered', (data) => { received = data })
      dispatch('user:registered', { name: 'Alice', id: 1 })
      expect(received).toEqual({ name: 'Alice', id: 1 })
      // Clean up
      off('user:registered')
    })

    test('off removes handlers on global bus', () => {
      let count = 0
      const handler = () => count++
      listen('user:logged-in', handler)
      dispatch('user:logged-in', { name: 'Bob' })
      expect(count).toBe(1)
      off('user:logged-in', handler)
      dispatch('user:logged-in', { name: 'Bob' })
      expect(count).toBe(1) // handler was removed
    })

    test('emitter.all contains registered handlers', () => {
      const handler = () => {}
      listen('user:logged-out', handler)
      const handlers = emitter.all.get('user:logged-out')
      expect(handlers).toContain(handler)
      off('user:logged-out', handler)
    })

    test('events.all is accessible', () => {
      expect(events.all).toBeInstanceOf(Map)
    })
  })

  describe('Edge cases', () => {
    test('emit with no handlers does not throw', () => {
      const bus = mitt<{ orphan: string }>()
      expect(() => bus.emit('orphan', 'no one listens')).not.toThrow()
    })

    test('handler map is accessible via .all', () => {
      const bus = mitt<{ ev: number }>()
      bus.on('ev', () => {})
      expect(bus.all.get('ev')!.length).toBe(1)
    })

    test('multiple mitt instances are independent', () => {
      const bus1 = mitt<{ msg: string }>()
      const bus2 = mitt<{ msg: string }>()
      let val1 = ''
      let val2 = ''
      bus1.on('msg', (v) => { val1 = v })
      bus2.on('msg', (v) => { val2 = v })
      bus1.emit('msg', 'from-1')
      expect(val1).toBe('from-1')
      expect(val2).toBe('') // bus2 did not receive
    })
  })
})
