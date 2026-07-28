import { describe, expect, it } from 'bun:test'
import { isWebSocketUpgrade } from '../src/request'

describe('isWebSocketUpgrade', () => {
  it('accepts websocket upgrade headers case-insensitively', () => {
    expect(isWebSocketUpgrade(new Request('http://localhost', {
      headers: { upgrade: 'websocket' },
    }))).toBe(true)
    expect(isWebSocketUpgrade(new Request('http://localhost', {
      headers: { upgrade: 'WebSocket' },
    }))).toBe(true)
  })

  it('rejects ordinary HTTP requests before Bun upgrade work', () => {
    expect(isWebSocketUpgrade(new Request('http://localhost'))).toBe(false)
    expect(isWebSocketUpgrade(new Request('http://localhost', {
      headers: { upgrade: 'h2c' },
    }))).toBe(false)
  })
})
