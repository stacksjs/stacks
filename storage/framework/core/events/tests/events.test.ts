import type { UserModel } from '../../../orm/src/models/User'
import { describe, expect, mock, test } from 'bun:test'
import { all, dispatch, events, listen, mitt, off, useEvent, useEvents } from '../src'

describe('@stacksjs/events', () => {
  test('mitt creates a functional event emitter', () => {
    const emitter = mitt<{ test: string }>()
    const handler = mock(() => {})

    emitter.on('test', handler)
    emitter.emit('test', 'hello')

    expect(handler).toHaveBeenCalledWith('hello')
  })

  test('off removes event listeners', () => {
    const emitter = mitt<{ test: string }>()
    const handler = mock(() => {})

    emitter.on('test', handler)
    emitter.off('test', handler)
    emitter.emit('test', 'hello')

    expect(handler).not.toHaveBeenCalled()
  })

  test('wildcard listeners receive all events', () => {
    const emitter = mitt<{ test1: string, test2: number }>()
    const handler = mock(() => {})

    emitter.on('*', handler)
    emitter.emit('test1', 'hello')
    emitter.emit('test2', 42)

    expect(handler).toHaveBeenCalledTimes(2)
    expect(handler).toHaveBeenCalledWith('test1', 'hello')
    expect(handler).toHaveBeenCalledWith('test2', 42)
  })

  test('off removes all listeners of a given type when no handler is provided', () => {
    const emitter = mitt<{ test: string }>()
    const handler1 = mock(() => {})
    const handler2 = mock(() => {})

    emitter.on('test', handler1)
    emitter.on('test', handler2)
    emitter.off('test')
    emitter.emit('test', 'hello')

    expect(handler1).not.toHaveBeenCalled()
    expect(handler2).not.toHaveBeenCalled()
  })

  test('events creates a mitt instance with StacksEvents', () => {
    const emitter = events
    expect(emitter).toHaveProperty('on')
    expect(emitter).toHaveProperty('off')
    expect(emitter).toHaveProperty('emit')
  })

  test('listen is an alias for on', () => {
    const handler = mock(() => {})
    listen('user:registered', handler)
    dispatch('user:registered', { name: 'John Doe' })
    expect(handler).toHaveBeenCalledWith({ name: 'John Doe' })
  })

  test('dispatch is an alias for emit', () => {
    const handler = mock(() => {})
    listen('user:logged-in', handler)
    dispatch('user:logged-in', { id: 1 })
    expect(handler).toHaveBeenCalledWith({ userId: 1 })
  })

  test('useEvent is an alias for emit', () => {
    const handler = mock(() => {})
    listen('user:logged-out', handler)
    useEvent('user:logged-out', { id: 1 })
    expect(handler).toHaveBeenCalledWith({ userId: 1 })
  })

  test('useEvents provides access to the event emitter', () => {
    expect(useEvents).toHaveProperty('on')
    expect(useEvents).toHaveProperty('off')
    expect(useEvents).toHaveProperty('emit')
  })

  test('all provides access to the event handler map', () => {
    const handler = mock(() => {})
    listen('user:updated', handler)
    expect(all.get('user:updated')).toContain(handler)
  })

  test('off removes a specific listener', () => {
    const handler = mock(() => {})
    listen('user:password-changed', handler)
    off('user:password-changed', handler)
    dispatch('user:password-changed', { id: 1 })
    expect(handler).not.toHaveBeenCalled()
  })

  test('multiple events can be handled', () => {
    const registeredHandler = mock(() => {})
    const updatedHandler = mock(() => {})

    listen('user:registered', registeredHandler)
    listen('user:updated', updatedHandler)

    const userModel: Partial<UserModel> = { id: 1, name: 'John Doe' }

    dispatch('user:registered', { name: 'John Doe' })

    expect(registeredHandler).toHaveBeenCalledWith({ name: 'John Doe' })
    expect(updatedHandler).toHaveBeenCalledWith(userModel)
  })
})
