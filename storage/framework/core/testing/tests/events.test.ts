import { afterEach, describe, expect, it } from 'bun:test'
import { events } from '@stacksjs/events'
import { eventFake, eventsAreFaked, getDispatchedEvents, hasDispatchedEvent, restoreEvents } from '../src/events'

afterEach(() => {
  restoreEvents()
  events.all.clear()
})

describe('eventFake', () => {
  it('records what was dispatched', () => {
    eventFake()
    events.emit('user:created' as never, { id: 1 } as never)

    expect(getDispatchedEvents('user:created')).toEqual([{ type: 'user:created', payload: { id: 1 } }])
  })

  it('stops the real listeners running', () => {
    let ran = 0
    events.on('user:created' as never, (() => { ran++ }) as never)

    eventFake()
    events.emit('user:created' as never, { id: 1 } as never)

    // Suppression is the point: asserting an event fired should not also run
    // everything that listens for it.
    expect(ran).toBe(0)
    expect(hasDispatchedEvent('user:created')).toBe(true)
  })

  it('puts the real listeners back', () => {
    let ran = 0
    events.on('user:created' as never, (() => { ran++ }) as never)

    eventFake()
    restoreEvents()
    events.emit('user:created' as never, { id: 1 } as never)

    expect(ran).toBe(1)
    expect(eventsAreFaked()).toBe(false)
  })

  it('is idempotent, so a second call does not lose the real listeners', () => {
    let ran = 0
    events.on('user:created' as never, (() => { ran++ }) as never)

    eventFake()
    // Without the guard this would snapshot the ALREADY-CLEARED map, and
    // restoring would put back nothing.
    eventFake()
    restoreEvents()
    events.emit('user:created' as never, { id: 1 } as never)

    expect(ran).toBe(1)
  })

  it('filters by type', () => {
    eventFake()
    events.emit('user:created' as never, { id: 1 } as never)
    events.emit('user:deleted' as never, { id: 2 } as never)

    expect(getDispatchedEvents('user:created')).toHaveLength(1)
    expect(getDispatchedEvents()).toHaveLength(2)
  })

  it('returns a copy, so a held result does not grow underneath the test', () => {
    eventFake()
    events.emit('user:created' as never, { id: 1 } as never)
    const first = getDispatchedEvents()
    events.emit('user:created' as never, { id: 2 } as never)

    expect(first).toHaveLength(1)
  })

  it('throws rather than returning [] when nothing is recording', () => {
    // An empty array here reads as "the event did not fire", which is the
    // wrong conclusion and an expensive one to debug.
    expect(() => getDispatchedEvents()).toThrow(/without eventFake\(\)/)
  })

  it('restores quietly when no fake is active', () => {
    expect(() => restoreEvents()).not.toThrow()
  })
})
