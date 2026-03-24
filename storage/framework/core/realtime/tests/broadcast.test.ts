import { describe, expect, test } from 'bun:test'

// eslint-disable-next-line antfu/no-import-dist
const { Broadcast } = await import('../src/broadcast')

// ---------------------------------------------------------------------------
// Tests use the real Broadcast class directly — no mocks.
// When no server is set, broadcast() logs a warning instead of throwing.
// We test structure and behavior with a manually set server.
// ---------------------------------------------------------------------------

describe('Broadcast', () => {
  test('Broadcast class can be instantiated', () => {
    const bc = new Broadcast()
    expect(bc).toBeInstanceOf(Broadcast)
  })

  test('connect() resolves without error (no-op)', async () => {
    const bc = new Broadcast()
    await expect(bc.connect()).resolves.toBeUndefined()
  })

  test('disconnect() resolves without error (no-op)', async () => {
    const bc = new Broadcast()
    await expect(bc.disconnect()).resolves.toBeUndefined()
  })

  test('isConnected() returns false when server is not initialized', () => {
    // Ensure server is null first
    const { setServer } = require('../src/server-instance')
    setServer(null)

    const bc = new Broadcast()
    expect(bc.isConnected()).toBe(false)
  })

  test('broadcast() does not throw when server is not initialized', () => {
    const { setServer } = require('../src/server-instance')
    setServer(null)

    const bc = new Broadcast()
    // broadcast() logs a warning rather than throwing when no server
    expect(() => bc.broadcast('test', 'event', {})).not.toThrow()
  })
})

describe('Broadcast with server', () => {
  test('broadcast() with public channel sends to channel name as-is', () => {
    const { setServer } = require('../src/server-instance')
    const broadcasted: Array<{ channel: string, event: string, data: any }> = []
    setServer({
      broadcast(channelName: string, event: string, data: any) {
        broadcasted.push({ channel: channelName, event, data })
      },
    })

    try {
      const bc = new Broadcast()
      bc.broadcast('orders', 'created', { id: 1 }, 'public')
      expect(broadcasted).toContainEqual({ channel: 'orders', event: 'created', data: { id: 1 } })
    }
    finally {
      setServer(null)
    }
  })

  test('broadcast() with private type adds private- prefix', () => {
    const { setServer } = require('../src/server-instance')
    const broadcasted: Array<{ channel: string, event: string, data: any }> = []
    setServer({
      broadcast(channelName: string, event: string, data: any) {
        broadcasted.push({ channel: channelName, event, data })
      },
    })

    try {
      const bc = new Broadcast()
      bc.broadcast('orders', 'updated', { id: 2 }, 'private')
      expect(broadcasted).toContainEqual({ channel: 'private-orders', event: 'updated', data: { id: 2 } })
    }
    finally {
      setServer(null)
    }
  })

  test('broadcast() with private type does not double-prefix', () => {
    const { setServer } = require('../src/server-instance')
    const broadcasted: Array<{ channel: string, event: string, data: any }> = []
    setServer({
      broadcast(channelName: string, event: string, data: any) {
        broadcasted.push({ channel: channelName, event, data })
      },
    })

    try {
      const bc = new Broadcast()
      bc.broadcast('private-orders', 'updated', { id: 2 }, 'private')
      expect(broadcasted).toContainEqual({ channel: 'private-orders', event: 'updated', data: { id: 2 } })
    }
    finally {
      setServer(null)
    }
  })

  test('broadcast() with presence type adds presence- prefix', () => {
    const { setServer } = require('../src/server-instance')
    const broadcasted: Array<{ channel: string, event: string, data: any }> = []
    setServer({
      broadcast(channelName: string, event: string, data: any) {
        broadcasted.push({ channel: channelName, event, data })
      },
    })

    try {
      const bc = new Broadcast()
      bc.broadcast('chat', 'message', { text: 'hi' }, 'presence')
      expect(broadcasted).toContainEqual({ channel: 'presence-chat', event: 'message', data: { text: 'hi' } })
    }
    finally {
      setServer(null)
    }
  })

  test('broadcast() with presence type does not double-prefix', () => {
    const { setServer } = require('../src/server-instance')
    const broadcasted: Array<{ channel: string, event: string, data: any }> = []
    setServer({
      broadcast(channelName: string, event: string, data: any) {
        broadcasted.push({ channel: channelName, event, data })
      },
    })

    try {
      const bc = new Broadcast()
      bc.broadcast('presence-chat', 'message', { text: 'hi' }, 'presence')
      expect(broadcasted).toContainEqual({ channel: 'presence-chat', event: 'message', data: { text: 'hi' } })
    }
    finally {
      setServer(null)
    }
  })

  test('broadcast() defaults to public type', () => {
    const { setServer } = require('../src/server-instance')
    const broadcasted: Array<{ channel: string, event: string, data: any }> = []
    setServer({
      broadcast(channelName: string, event: string, data: any) {
        broadcasted.push({ channel: channelName, event, data })
      },
    })

    try {
      const bc = new Broadcast()
      bc.broadcast('events', 'fire', { data: true })
      expect(broadcasted).toContainEqual({ channel: 'events', event: 'fire', data: { data: true } })
    }
    finally {
      setServer(null)
    }
  })

  test('isConnected() returns true when server is initialized', () => {
    const { setServer } = require('../src/server-instance')
    setServer({ broadcast() {} })

    try {
      const bc = new Broadcast()
      expect(bc.isConnected()).toBe(true)
    }
    finally {
      setServer(null)
    }
  })

  test('subscribe() does not throw (warns about client-side usage)', () => {
    const bc = new Broadcast()
    expect(() => bc.subscribe('channel', () => {})).not.toThrow()
  })

  test('unsubscribe() does not throw (warns about client-side usage)', () => {
    const bc = new Broadcast()
    expect(() => bc.unsubscribe('channel')).not.toThrow()
  })
})
