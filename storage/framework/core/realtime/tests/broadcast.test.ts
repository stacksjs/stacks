import { beforeEach, describe, expect, mock, test } from 'bun:test'

const mockBroadcast = mock(() => {})
const mockWarn = mock(() => {})

// Mock dependencies
mock.module('../src/server-instance', () => ({
  getServer: () => ({
    broadcast: mockBroadcast,
  }),
}))

mock.module('@stacksjs/logging', () => ({
  log: {
    warn: mockWarn,
    error: mock(() => {}),
  },
}))

// eslint-disable-next-line antfu/no-import-dist
const { Broadcast } = await import('../src/broadcast')

describe('Broadcast', () => {
  beforeEach(() => {
    mockBroadcast.mockClear()
    mockWarn.mockClear()
  })

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

  test('broadcast() with public channel sends to channel name as-is', () => {
    const bc = new Broadcast()
    bc.broadcast('orders', 'created', { id: 1 }, 'public')
    expect(mockBroadcast).toHaveBeenCalledWith('orders', 'created', { id: 1 })
  })

  test('broadcast() with private type adds private- prefix', () => {
    const bc = new Broadcast()
    bc.broadcast('orders', 'updated', { id: 2 }, 'private')
    expect(mockBroadcast).toHaveBeenCalledWith('private-orders', 'updated', { id: 2 })
  })

  test('broadcast() with private type does not double-prefix', () => {
    const bc = new Broadcast()
    bc.broadcast('private-orders', 'updated', { id: 2 }, 'private')
    expect(mockBroadcast).toHaveBeenCalledWith('private-orders', 'updated', { id: 2 })
  })

  test('broadcast() with presence type adds presence- prefix', () => {
    const bc = new Broadcast()
    bc.broadcast('chat', 'message', { text: 'hi' }, 'presence')
    expect(mockBroadcast).toHaveBeenCalledWith('presence-chat', 'message', { text: 'hi' })
  })

  test('broadcast() with presence type does not double-prefix', () => {
    const bc = new Broadcast()
    bc.broadcast('presence-chat', 'message', { text: 'hi' }, 'presence')
    expect(mockBroadcast).toHaveBeenCalledWith('presence-chat', 'message', { text: 'hi' })
  })

  test('broadcast() defaults to public type', () => {
    const bc = new Broadcast()
    bc.broadcast('events', 'fire', { data: true })
    expect(mockBroadcast).toHaveBeenCalledWith('events', 'fire', { data: true })
  })

  test('isConnected() returns true when server is initialized', () => {
    const bc = new Broadcast()
    expect(bc.isConnected()).toBe(true)
  })

  test('subscribe() warns about client-side usage', () => {
    const bc = new Broadcast()
    bc.subscribe('channel', () => {})
    expect(mockWarn).toHaveBeenCalled()
  })

  test('unsubscribe() warns about client-side usage', () => {
    const bc = new Broadcast()
    bc.unsubscribe('channel')
    expect(mockWarn).toHaveBeenCalled()
  })
})

describe('Broadcast with no server', () => {
  test('broadcast() warns when server is not initialized', () => {
    mock.module('../src/server-instance', () => ({
      getServer: () => null,
    }))

    const { Broadcast: BroadcastNoServer } = require('../src/broadcast')
    const bc = new BroadcastNoServer()
    bc.broadcast('test', 'event', {})
    expect(mockWarn).toHaveBeenCalled()
  })
})
