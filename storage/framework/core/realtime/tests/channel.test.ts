import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { Channel, channel } from '../src/channel'

// Mock the server-instance module
const mockBroadcast = mock(() => Promise.resolve())

mock.module('../src/server-instance', () => ({
  getServer: () => ({
    broadcast: mockBroadcast,
  }),
}))

describe('Channel', () => {
  beforeEach(() => {
    mockBroadcast.mockClear()
  })

  test('Channel class can be instantiated with a name', () => {
    const ch = new Channel('orders')
    expect(ch).toBeInstanceOf(Channel)
  })

  test('channel() factory returns a Channel instance', () => {
    const ch = channel('orders')
    expect(ch).toBeInstanceOf(Channel)
  })

  test('public() broadcasts to the channel name as-is', async () => {
    const ch = new Channel('orders')
    await ch.public('created', { id: 1 })
    expect(mockBroadcast).toHaveBeenCalledWith('orders', 'created', { id: 1 })
  })

  test('private() adds private- prefix to channel name', async () => {
    const ch = new Channel('orders')
    await ch.private('updated', { status: 'shipped' })
    expect(mockBroadcast).toHaveBeenCalledWith('private-orders', 'updated', { status: 'shipped' })
  })

  test('private() does not double-prefix when already prefixed', async () => {
    const ch = new Channel('private-orders')
    await ch.private('updated', { status: 'shipped' })
    expect(mockBroadcast).toHaveBeenCalledWith('private-orders', 'updated', { status: 'shipped' })
  })

  test('presence() adds presence- prefix to channel name', async () => {
    const ch = new Channel('chat.room.1')
    await ch.presence('message', { text: 'Hello' })
    expect(mockBroadcast).toHaveBeenCalledWith('presence-chat.room.1', 'message', { text: 'Hello' })
  })

  test('presence() does not double-prefix when already prefixed', async () => {
    const ch = new Channel('presence-chat.room.1')
    await ch.presence('message', { text: 'Hello' })
    expect(mockBroadcast).toHaveBeenCalledWith('presence-chat.room.1', 'message', { text: 'Hello' })
  })

  test('broadcast() with public type calls public()', async () => {
    const ch = new Channel('orders')
    await ch.broadcast('created', { id: 1 }, 'public')
    expect(mockBroadcast).toHaveBeenCalledWith('orders', 'created', { id: 1 })
  })

  test('broadcast() with private type calls private()', async () => {
    const ch = new Channel('orders')
    await ch.broadcast('created', { id: 1 }, 'private')
    expect(mockBroadcast).toHaveBeenCalledWith('private-orders', 'created', { id: 1 })
  })

  test('broadcast() with presence type calls presence()', async () => {
    const ch = new Channel('chat')
    await ch.broadcast('join', { user: 'alice' }, 'presence')
    expect(mockBroadcast).toHaveBeenCalledWith('presence-chat', 'join', { user: 'alice' })
  })

  test('broadcast() defaults to public type when not specified', async () => {
    const ch = new Channel('notifications')
    await ch.broadcast('alert', { msg: 'test' })
    expect(mockBroadcast).toHaveBeenCalledWith('notifications', 'alert', { msg: 'test' })
  })
})

describe('Channel with no server', () => {
  test('public() throws when server is not initialized', async () => {
    // Override mock to return null server
    mock.module('../src/server-instance', () => ({
      getServer: () => null,
    }))

    // Re-import to get the new mock
    const { Channel: ChannelNoServer } = await import('../src/channel')
    const ch = new ChannelNoServer('test')
    expect(ch.public('event', {})).rejects.toThrow('Broadcast server not initialized')
  })
})
