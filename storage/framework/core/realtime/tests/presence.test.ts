import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { channel } from '../src/channel'
import { setServer } from '../src/server-instance'

// stacksjs/stacks#1877 R-4 — presence channel contract.
// The Stacks `channel().presence()` wrapper composes the
// `presence-` prefix and delegates to the underlying
// ts-broadcasting server.broadcast. These tests pin that
// composition so a future ts-broadcasting upgrade can't
// silently break the channel-name shape.

describe('Channel.presence() composition (stacksjs/stacks#1877 R-4)', () => {
  let broadcasts: Array<{ channel: string, event: string, data: unknown }> = []

  beforeEach(() => {
    broadcasts = []
    setServer({
      start: async () => {},
      stop: async () => {},
      broadcast: (ch: string, event: string, data: unknown) => {
        broadcasts.push({ channel: ch, event, data })
      },
    } as any)
  })

  afterEach(() => {
    broadcasts = []
  })

  test('public() broadcasts on the bare channel name', async () => {
    await channel('orders').public('created', { id: 1 })
    expect(broadcasts).toEqual([{ channel: 'orders', event: 'created', data: { id: 1 } }])
  })

  test('presence() prepends "presence-" to the channel name', async () => {
    await channel('chat.room.1').presence('message', { text: 'hi' })
    expect(broadcasts).toEqual([{ channel: 'presence-chat.room.1', event: 'message', data: { text: 'hi' } }])
  })

  test('presence() strips existing private- or presence- prefix before re-prefixing', async () => {
    // Defensive: if a caller passes 'private-foo' to .presence(),
    // the result should be 'presence-foo', not 'presence-private-foo'.
    await channel('private-orders').presence('joined', { userId: 7 })
    expect(broadcasts).toEqual([{ channel: 'presence-orders', event: 'joined', data: { userId: 7 } }])
  })

  test('broadcast(type: "presence") delegates to presence()', async () => {
    await channel('room').broadcast('typing', { user: 'alice' }, 'presence')
    expect(broadcasts).toEqual([{ channel: 'presence-room', event: 'typing', data: { user: 'alice' } }])
  })

  test('multiple presence broadcasts in order produce the expected sequence', async () => {
    // Pins that join → message → leave appears in that order on the
    // bus. Apps build presence-event semantics on top of this
    // ordering contract.
    await channel('room').presence('member.joined', { userId: 1 })
    await channel('room').presence('message', { from: 1, text: 'hi' })
    await channel('room').presence('member.left', { userId: 1 })

    expect(broadcasts.map(b => b.event)).toEqual(['member.joined', 'message', 'member.left'])
    expect(broadcasts.every(b => b.channel === 'presence-room')).toBe(true)
  })

  test('presence() throws when broadcast server is not initialized', async () => {
    setServer(null as any)
    await expect(channel('room').presence('x', {})).rejects.toThrow(/not initialized/)
  })
})
