import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { getHeartbeatConfig, markPong, runOneTick, setHeartbeatConfig } from '../src/heartbeat'
import { setServer } from '../src/server-instance'

// stacksjs/stacks#1877 R-5 — pins the heartbeat contract:
// - opt-in (default off, no behavior change)
// - sends ping(); falls back to send('__stacks_ping__') when no native ping
// - tracks missed pongs per-socket; calls onDead after threshold
// - markPong() resets the counter

describe('Heartbeat (stacksjs/stacks#1877 R-5)', () => {
  beforeEach(() => {
    setHeartbeatConfig(null)
  })

  afterEach(() => {
    setHeartbeatConfig(null)
  })

  test('default is off (no config installed)', () => {
    expect(getHeartbeatConfig()).toBeNull()
  })

  test('setHeartbeatConfig({}) installs defaults', () => {
    setHeartbeatConfig({})
    const cfg = getHeartbeatConfig()
    expect(cfg).not.toBeNull()
    expect(cfg!.intervalMs).toBe(30_000)
    expect(cfg!.maxMissedPongs).toBe(2)
  })

  test('runOneTick sends ping() to each known socket', () => {
    const pings: string[] = []
    const socket = {
      id: 'a',
      ping: () => { pings.push('a') },
    }
    setServer({
      start: async () => {},
      stop: async () => {},
      channels: new Map([['ch1', new Set([socket])]]),
    } as any)
    setHeartbeatConfig({ intervalMs: 60_000, maxMissedPongs: 5 })

    runOneTick()
    expect(pings).toEqual(['a'])
  })

  test('falls back to send("__stacks_ping__") when no native ping', () => {
    const sends: string[] = []
    const socket = {
      id: 'a',
      send: (data: string) => { sends.push(data) },
    }
    setServer({
      start: async () => {},
      stop: async () => {},
      channels: new Map([['ch1', new Set([socket])]]),
    } as any)
    setHeartbeatConfig({ intervalMs: 60_000, maxMissedPongs: 5 })

    runOneTick()
    expect(sends).toEqual(['__stacks_ping__'])
  })

  test('declares socket dead after maxMissedPongs consecutive pings', () => {
    const dead: object[] = []
    const socket = {
      id: 'dying',
      ping: () => { /* never pongs */ },
    }
    setServer({
      start: async () => {},
      stop: async () => {},
      channels: new Map([['ch1', new Set([socket])]]),
    } as any)
    setHeartbeatConfig({
      intervalMs: 60_000,
      maxMissedPongs: 2,
      onDead: ws => dead.push(ws as object),
    })

    runOneTick() // missed=1
    runOneTick() // missed=2
    runOneTick() // declares dead
    expect(dead).toHaveLength(1)
    expect(dead[0]).toBe(socket)
  })

  test('markPong resets the missed counter', () => {
    const dead: object[] = []
    const socket = {
      id: 's',
      ping: () => {},
    }
    setServer({
      start: async () => {},
      stop: async () => {},
      channels: new Map([['ch1', new Set([socket])]]),
    } as any)
    setHeartbeatConfig({
      intervalMs: 60_000,
      maxMissedPongs: 2,
      onDead: ws => dead.push(ws as object),
    })

    runOneTick() // missed=1
    markPong(socket) // reset to 0
    runOneTick() // missed=1 again
    runOneTick() // missed=2
    // Still not dead — needs one more tick past threshold.
    expect(dead).toHaveLength(0)
    runOneTick()
    expect(dead).toHaveLength(1)
  })

  test('clearing config stops the interval', () => {
    setHeartbeatConfig({ intervalMs: 60_000 })
    expect(getHeartbeatConfig()).not.toBeNull()
    setHeartbeatConfig(null)
    expect(getHeartbeatConfig()).toBeNull()
  })
})
