import { describe, expect, test } from 'bun:test'
import { BroadcastNotificationDriver, useBroadcast } from '../src'

// stacksjs/stacks#669 — broadcast notifications driver (realtime WS fanout).

describe('BroadcastNotificationDriver', () => {
  test('useBroadcast() returns the driver', () => {
    expect(useBroadcast()).toBe(BroadcastNotificationDriver)
  })

  test('send returns delivered:false when no realtime server is running', async () => {
    // Test envs don't boot the WS server; emit() returns early when
    // getServer() is null. The driver wraps that as a clean negative.
    const result = await BroadcastNotificationDriver.send({
      channel: 'notifications',
      event: 'test',
      data: { body: 'hello' },
    })
    // Either the realtime module is unavailable, or it's available but
    // no server is wired — both are graceful no-ops with delivered:false.
    expect(result.delivered).toBe(false)
    expect(result.channel).toBe('notifications')
    expect(result.event).toBe('test')
    expect(typeof result.reason).toBe('string')
  })

  test('derives private-user-{id} channel when only userId is provided', async () => {
    const result = await BroadcastNotificationDriver.send({
      userId: 42,
      event: 'new-message',
      data: { body: 'hi' },
    })
    expect(result.channel).toBe('private-user-42')
    expect(result.event).toBe('new-message')
  })

  test('falls back to public "notifications" channel with no userId / channel', async () => {
    const result = await BroadcastNotificationDriver.send({
      data: { body: 'broadcast to all' },
    })
    expect(result.channel).toBe('notifications')
    expect(result.event).toBe('notification') // default
  })

  test('explicit channel wins over userId-derived default', async () => {
    const result = await BroadcastNotificationDriver.send({
      userId: 42,
      channel: 'presence-room-7',
      event: 'message',
    })
    expect(result.channel).toBe('presence-room-7')
  })

  test('event defaults to "notification" when omitted', async () => {
    const result = await BroadcastNotificationDriver.send({
      channel: 'notifications',
    })
    expect(result.event).toBe('notification')
  })
})
