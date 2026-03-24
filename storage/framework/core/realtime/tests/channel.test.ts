import { describe, expect, test } from 'bun:test'
import { Channel, channel } from '../src/channel'

// ---------------------------------------------------------------------------
// Tests use the real Channel class directly — no mocks.
// The Channel class calls getServer() internally. When no server is set,
// it throws 'Broadcast server not initialized', which we test explicitly.
// ---------------------------------------------------------------------------

describe('Channel', () => {
  test('Channel class can be instantiated with a name', () => {
    const ch = new Channel('orders')
    expect(ch).toBeInstanceOf(Channel)
  })

  test('channel() factory returns a Channel instance', () => {
    const ch = channel('orders')
    expect(ch).toBeInstanceOf(Channel)
  })

  test('public() throws when server is not initialized', async () => {
    const ch = new Channel('orders')
    expect(ch.public('created', { id: 1 })).rejects.toThrow('Broadcast server not initialized')
  })

  test('private() throws when server is not initialized', async () => {
    const ch = new Channel('orders')
    expect(ch.private('updated', { status: 'shipped' })).rejects.toThrow('Broadcast server not initialized')
  })

  test('presence() throws when server is not initialized', async () => {
    const ch = new Channel('chat.room.1')
    expect(ch.presence('message', { text: 'Hello' })).rejects.toThrow('Broadcast server not initialized')
  })

  test('broadcast() with public type throws when server is not initialized', async () => {
    const ch = new Channel('orders')
    expect(ch.broadcast('created', { id: 1 }, 'public')).rejects.toThrow('Broadcast server not initialized')
  })

  test('broadcast() with private type throws when server is not initialized', async () => {
    const ch = new Channel('orders')
    expect(ch.broadcast('created', { id: 1 }, 'private')).rejects.toThrow('Broadcast server not initialized')
  })

  test('broadcast() with presence type throws when server is not initialized', async () => {
    const ch = new Channel('chat')
    expect(ch.broadcast('join', { user: 'alice' }, 'presence')).rejects.toThrow('Broadcast server not initialized')
  })

  test('broadcast() defaults to public type when not specified', async () => {
    const ch = new Channel('notifications')
    // defaults to 'public', which still requires a server
    expect(ch.broadcast('alert', { msg: 'test' })).rejects.toThrow('Broadcast server not initialized')
  })
})

describe('Channel with setServer', () => {
  test('Channel works with a manually set server', async () => {
    // Import setServer to inject a fake server for this test
    const { setServer, getServer } = await import('../src/server-instance')
    const broadcasted: Array<{ channel: string, event: string, data: any }> = []

    // Set a real-shaped server object (not a mock.module, just a plain object)
    setServer({
      broadcast(channelName: string, event: string, data: any) {
        broadcasted.push({ channel: channelName, event, data })
      },
    } as any)

    try {
      const ch = new Channel('orders')
      await ch.public('created', { id: 1 })
      expect(broadcasted).toContainEqual({ channel: 'orders', event: 'created', data: { id: 1 } })

      await ch.private('updated', { status: 'shipped' })
      expect(broadcasted).toContainEqual({ channel: 'private-orders', event: 'updated', data: { status: 'shipped' } })

      // private- prefix should not be doubled
      const ch2 = new Channel('private-orders')
      await ch2.private('updated', { status: 'shipped' })
      expect(broadcasted).toContainEqual({ channel: 'private-orders', event: 'updated', data: { status: 'shipped' } })

      const ch3 = new Channel('chat.room.1')
      await ch3.presence('message', { text: 'Hello' })
      expect(broadcasted).toContainEqual({ channel: 'presence-chat.room.1', event: 'message', data: { text: 'Hello' } })

      // presence- prefix should not be doubled
      const ch4 = new Channel('presence-chat.room.1')
      await ch4.presence('message', { text: 'Hello' })
      expect(broadcasted).toContainEqual({ channel: 'presence-chat.room.1', event: 'message', data: { text: 'Hello' } })
    }
    finally {
      // Clean up: reset server to null
      setServer(null as any)
    }
  })
})
