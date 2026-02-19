import { afterEach, describe, expect, mock, test } from 'bun:test'
import { all, dispatch, emitter, events, listen, mitt, off, useEvent, useEvents, useListen } from '../src'

describe('@stacksjs/events', () => {
  afterEach(() => {
    // Clean up all registered handlers between tests
    for (const [key] of all) {
      all.set(key, [])
    }
  })

  describe('mitt()', () => {
    test('should create a functional event emitter', () => {
      const em = mitt<{ test: string }>()
      const handler = mock(() => {})

      em.on('test', handler)
      em.emit('test', 'hello')

      expect(handler).toHaveBeenCalledWith('hello')
    })

    test('should support multiple handlers for the same event', () => {
      const em = mitt<{ test: string }>()
      const handler1 = mock(() => {})
      const handler2 = mock(() => {})

      em.on('test', handler1)
      em.on('test', handler2)
      em.emit('test', 'hello')

      expect(handler1).toHaveBeenCalledWith('hello')
      expect(handler2).toHaveBeenCalledWith('hello')
    })

    test('should not fire handler for different event types', () => {
      const em = mitt<{ a: string, b: number }>()
      const handler = mock(() => {})

      em.on('a', handler)
      em.emit('b', 42)

      expect(handler).not.toHaveBeenCalled()
    })

    test('should handle object payloads', () => {
      const em = mitt<{ test: { name: string, id: number } }>()
      const handler = mock(() => {})

      em.on('test', handler)
      em.emit('test', { name: 'Alice', id: 1 })

      expect(handler).toHaveBeenCalledWith({ name: 'Alice', id: 1 })
    })
  })

  describe('off()', () => {
    test('should remove a specific event listener', () => {
      const em = mitt<{ test: string }>()
      const handler = mock(() => {})

      em.on('test', handler)
      em.off('test', handler)
      em.emit('test', 'hello')

      expect(handler).not.toHaveBeenCalled()
    })

    test('should remove all listeners of a given type when no handler is provided', () => {
      const em = mitt<{ test: string }>()
      const handler1 = mock(() => {})
      const handler2 = mock(() => {})

      em.on('test', handler1)
      em.on('test', handler2)
      em.off('test')
      em.emit('test', 'hello')

      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).not.toHaveBeenCalled()
    })

    test('should only remove the specified handler', () => {
      const em = mitt<{ test: string }>()
      const handler1 = mock(() => {})
      const handler2 = mock(() => {})

      em.on('test', handler1)
      em.on('test', handler2)
      em.off('test', handler1)
      em.emit('test', 'hello')

      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).toHaveBeenCalledWith('hello')
    })
  })

  describe('wildcard listeners', () => {
    test('should receive all events', () => {
      const em = mitt<{ a: string, b: number }>()
      const handler = mock(() => {})

      em.on('*', handler)
      em.emit('a', 'hello')
      em.emit('b', 42)

      expect(handler).toHaveBeenCalledTimes(2)
      expect(handler).toHaveBeenCalledWith('a', 'hello')
      expect(handler).toHaveBeenCalledWith('b', 42)
    })

    test('should fire after type-specific handlers', () => {
      const em = mitt<{ test: string }>()
      const order: string[] = []

      em.on('test', () => order.push('specific'))
      em.on('*', () => order.push('wildcard'))
      em.emit('test', 'hello')

      expect(order).toEqual(['specific', 'wildcard'])
    })

    test('should be removable via off', () => {
      const em = mitt<{ test: string }>()
      const handler = mock(() => {})

      em.on('*', handler)
      em.off('*', handler)
      em.emit('test', 'hello')

      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('StacksEvents emitter', () => {
    test('events should be a valid emitter', () => {
      expect(events).toHaveProperty('on')
      expect(events).toHaveProperty('off')
      expect(events).toHaveProperty('emit')
      expect(events).toHaveProperty('all')
    })

    test('emitter should be the same instance as events', () => {
      expect(emitter).toBe(events)
    })

    test('useEvents should be the same instance as events', () => {
      expect(useEvents).toBe(events)
    })
  })

  describe('dispatch() and listen()', () => {
    test('listen should register a handler and dispatch should fire it', () => {
      const handler = mock(() => {})
      listen('user:registered', handler)
      dispatch('user:registered', { name: 'John Doe', email: 'john@test.com' })

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith({ name: 'John Doe', email: 'john@test.com' })
    })

    test('useEvent should work the same as dispatch', () => {
      const handler = mock(() => {})
      listen('user:logged-in', handler)
      useEvent('user:logged-in', { id: 1 })

      expect(handler).toHaveBeenCalledWith({ id: 1 })
    })

    test('useListen should work the same as listen', () => {
      const handler = mock(() => {})
      useListen('user:logged-out', handler)
      dispatch('user:logged-out', { id: 1 })

      expect(handler).toHaveBeenCalledWith({ id: 1 })
    })
  })

  describe('off()', () => {
    test('should remove a specific listener from StacksEvents', () => {
      const handler = mock(() => {})
      listen('user:password-changed', handler)
      off('user:password-changed', handler)
      dispatch('user:password-changed', { id: 1 })

      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('all handler map', () => {
    test('should provide access to the handler map', () => {
      const handler = mock(() => {})
      listen('user:registered', handler)

      const handlers = all.get('user:registered')
      expect(handlers).toBeDefined()
      expect(handlers).toContain(handler)
    })
  })

  describe('model events', () => {
    test('should support model CRUD event patterns', () => {
      const createdHandler = mock(() => {})
      const updatedHandler = mock(() => {})
      const deletedHandler = mock(() => {})

      listen('user:created', createdHandler)
      listen('user:updated', updatedHandler)
      listen('user:deleted', deletedHandler)

      dispatch('user:created', { id: 1, name: 'Alice' })
      dispatch('user:updated', { id: 1, name: 'Alice Updated' })
      dispatch('user:deleted', { id: 1 })

      expect(createdHandler).toHaveBeenCalledWith({ id: 1, name: 'Alice' })
      expect(updatedHandler).toHaveBeenCalledWith({ id: 1, name: 'Alice Updated' })
      expect(deletedHandler).toHaveBeenCalledWith({ id: 1 })
    })

    test('should support commerce model events', () => {
      const handler = mock(() => {})
      listen('order:created', handler)
      dispatch('order:created', { id: 1, total: 99.99, status: 'pending' })

      expect(handler).toHaveBeenCalledWith({ id: 1, total: 99.99, status: 'pending' })
    })
  })

  describe('multiple handlers', () => {
    test('should call all handlers for the same event', () => {
      const handler1 = mock(() => {})
      const handler2 = mock(() => {})
      const handler3 = mock(() => {})

      listen('user:registered', handler1)
      listen('user:registered', handler2)
      listen('user:registered', handler3)

      dispatch('user:registered', { name: 'Test' })

      expect(handler1).toHaveBeenCalledTimes(1)
      expect(handler2).toHaveBeenCalledTimes(1)
      expect(handler3).toHaveBeenCalledTimes(1)
    })

    test('should isolate handlers between event types', () => {
      const registeredHandler = mock(() => {})
      const createdHandler = mock(() => {})

      listen('user:registered', registeredHandler)
      listen('user:created', createdHandler)

      dispatch('user:registered', { name: 'Test' })

      expect(registeredHandler).toHaveBeenCalledTimes(1)
      expect(createdHandler).not.toHaveBeenCalled()
    })
  })

  describe('handler execution order', () => {
    test('should call handlers in registration order', () => {
      const em = mitt<{ test: string }>()
      const order: number[] = []

      em.on('test', () => order.push(1))
      em.on('test', () => order.push(2))
      em.on('test', () => order.push(3))
      em.emit('test', 'go')

      expect(order).toEqual([1, 2, 3])
    })
  })

  describe('edge cases', () => {
    test('should not throw when emitting with no handlers', () => {
      const em = mitt<{ test: string }>()
      expect(() => em.emit('test', 'hello')).not.toThrow()
    })

    test('should handle rapid successive emits', () => {
      const em = mitt<{ test: number }>()
      const handler = mock(() => {})

      em.on('test', handler)
      for (let i = 0; i < 1000; i++) {
        em.emit('test', i)
      }

      expect(handler).toHaveBeenCalledTimes(1000)
    })

    test('should allow removing handler during emit', () => {
      const em = mitt<{ test: string }>()
      const handler = mock(() => {
        em.off('test', handler)
      })

      em.on('test', handler)
      em.emit('test', 'first')
      em.emit('test', 'second')

      // Handler ran on first emit, then was removed
      expect(handler).toHaveBeenCalledTimes(1)
    })
  })
})
