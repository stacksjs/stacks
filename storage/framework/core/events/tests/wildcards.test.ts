import { afterEach, describe, expect, mock, test } from 'bun:test'
import { all, dispatch, listen, mitt, off, useEvent, useEvents, useListen } from '../src'

describe('@stacksjs/events - wildcard pattern matching', () => {
  afterEach(() => {
    for (const [key] of all) {
      all.set(key, [])
    }
  })

  describe('global wildcard (*)', () => {
    test('* catches all emitted events', () => {
      const em = mitt<{ 'user:created': { id: number }, 'post:created': { title: string } }>()
      const handler = mock(() => {})

      em.on('*', handler)
      em.emit('user:created', { id: 1 })
      em.emit('post:created', { title: 'Hello' })

      expect(handler).toHaveBeenCalledTimes(2)
      expect(handler).toHaveBeenCalledWith('user:created', { id: 1 })
      expect(handler).toHaveBeenCalledWith('post:created', { title: 'Hello' })
    })

    test('* handler fires after type-specific handlers', () => {
      const em = mitt<{ test: string }>()
      const order: string[] = []

      em.on('test', () => order.push('specific'))
      em.on('*', () => order.push('wildcard'))
      em.emit('test', 'data')

      expect(order).toEqual(['specific', 'wildcard'])
    })
  })

  describe('prefix patterns (e.g. user:*)', () => {
    test('user:* catches user:created, user:updated, user:deleted', () => {
      const em = mitt<{
        'user:created': { id: number }
        'user:updated': { id: number }
        'user:deleted': { id: number }
        'post:created': { id: number }
      }>()
      const handler = mock(() => {})

      em.on('user:*' as any, handler)
      em.emit('user:created', { id: 1 })
      em.emit('user:updated', { id: 2 })
      em.emit('user:deleted', { id: 3 })
      em.emit('post:created', { id: 4 })

      expect(handler).toHaveBeenCalledTimes(3)
      expect(handler).toHaveBeenCalledWith('user:created', { id: 1 })
      expect(handler).toHaveBeenCalledWith('user:updated', { id: 2 })
      expect(handler).toHaveBeenCalledWith('user:deleted', { id: 3 })
    })

    test('user:* does not fire for post:created', () => {
      const em = mitt<{ 'user:created': string, 'post:created': string }>()
      const handler = mock(() => {})

      em.on('user:*' as any, handler)
      em.emit('post:created', 'a post')

      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('suffix patterns (e.g. *.created)', () => {
    test('*.created catches user:created and post:created', () => {
      const em = mitt<{
        'user:created': { id: number }
        'post:created': { id: number }
        'user:updated': { id: number }
      }>()
      const handler = mock(() => {})

      em.on('*.created' as any, handler)
      em.emit('user:created', { id: 1 })
      em.emit('post:created', { id: 2 })
      em.emit('user:updated', { id: 3 })

      expect(handler).toHaveBeenCalledTimes(2)
      expect(handler).toHaveBeenCalledWith('user:created', { id: 1 })
      expect(handler).toHaveBeenCalledWith('post:created', { id: 2 })
    })

    test('*.created does not fire for user:deleted', () => {
      const em = mitt<{ 'user:deleted': { id: number } }>()
      const handler = mock(() => {})

      em.on('*.created' as any, handler)
      em.emit('user:deleted', { id: 1 })

      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('exact match alongside wildcards', () => {
    test('exact handler and pattern handler both fire', () => {
      const em = mitt<{ 'user:created': { id: number } }>()
      const exactHandler = mock(() => {})
      const patternHandler = mock(() => {})

      em.on('user:created', exactHandler)
      em.on('user:*' as any, patternHandler)
      em.emit('user:created', { id: 1 })

      expect(exactHandler).toHaveBeenCalledTimes(1)
      expect(patternHandler).toHaveBeenCalledTimes(1)
    })

    test('exact, pattern, and global wildcard all fire in order', () => {
      const em = mitt<{ 'user:created': { id: number } }>()
      const order: string[] = []

      em.on('user:created', () => order.push('exact'))
      em.on('user:*' as any, () => order.push('pattern'))
      em.on('*', () => order.push('global'))
      em.emit('user:created', { id: 1 })

      expect(order).toEqual(['exact', 'pattern', 'global'])
    })
  })

  describe('off() with patterns', () => {
    test('off() removes a specific wildcard handler', () => {
      const em = mitt<{ 'user:created': string }>()
      const handler = mock(() => {})

      em.on('user:*' as any, handler)
      em.off('user:*' as any, handler)
      em.emit('user:created', 'test')

      expect(handler).not.toHaveBeenCalled()
    })

    test('off() removes a global * handler', () => {
      const em = mitt<{ test: string }>()
      const handler = mock(() => {})

      em.on('*', handler)
      em.off('*', handler)
      em.emit('test', 'data')

      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('multiple handlers on same pattern', () => {
    test('multiple handlers on user:* all fire', () => {
      const em = mitt<{ 'user:created': { id: number } }>()
      const handler1 = mock(() => {})
      const handler2 = mock(() => {})
      const handler3 = mock(() => {})

      em.on('user:*' as any, handler1)
      em.on('user:*' as any, handler2)
      em.on('user:*' as any, handler3)
      em.emit('user:created', { id: 1 })

      expect(handler1).toHaveBeenCalledTimes(1)
      expect(handler2).toHaveBeenCalledTimes(1)
      expect(handler3).toHaveBeenCalledTimes(1)
    })
  })

  describe('handler error isolation', () => {
    test('error in one handler does not crash other handlers', () => {
      const em = mitt<{ 'user:created': { id: number } }>()
      const goodHandler = mock(() => {})
      const badHandler = mock(() => {
        throw new Error('handler error')
      })

      em.on('user:created', badHandler)
      em.on('user:created', goodHandler)

      // Should not throw
      expect(() => em.emit('user:created', { id: 1 })).not.toThrow()
      expect(goodHandler).toHaveBeenCalledTimes(1)
    })

    test('error in pattern handler does not crash other pattern handlers', () => {
      const em = mitt<{ 'user:created': { id: number } }>()
      const goodHandler = mock(() => {})
      const badHandler = mock(() => {
        throw new Error('pattern handler error')
      })

      em.on('user:*' as any, badHandler)
      em.on('user:*' as any, goodHandler)

      expect(() => em.emit('user:created', { id: 1 })).not.toThrow()
      expect(goodHandler).toHaveBeenCalledTimes(1)
    })
  })

  describe('dispatch with data', () => {
    test('dispatch passes data to pattern handlers', () => {
      const handler = mock(() => {})

      listen('user:*' as any, handler)
      dispatch('user:registered', { name: 'Alice', email: 'alice@test.com' })

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith('user:registered', { name: 'Alice', email: 'alice@test.com' })
    })
  })

  describe('aliases: useEvent, useListen, useEvents', () => {
    test('useEvent dispatches and useListen listens', () => {
      const handler = mock(() => {})

      useListen('user:logged-in', handler)
      useEvent('user:logged-in', { id: 42 })

      expect(handler).toHaveBeenCalledWith({ id: 42 })
    })

    test('useEvents exposes the same emitter', () => {
      const handler = mock(() => {})

      useEvents.on('user:password-reset', handler)
      useEvents.emit('user:password-reset', { id: 5 })

      expect(handler).toHaveBeenCalledWith({ id: 5 })
    })

    test('off removes a handler registered via listen', () => {
      const handler = mock(() => {})

      listen('user:password-changed', handler)
      off('user:password-changed', handler)
      dispatch('user:password-changed', { id: 1 })

      expect(handler).not.toHaveBeenCalled()
    })
  })
})
