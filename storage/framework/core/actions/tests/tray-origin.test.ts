import { describe, expect, it } from 'bun:test'
import { isTrustedTrayRequest, trayOrigins } from '../src/dev/tray-origin'

/**
 * stacksjs/stacks#3199: any page open in the browser could drive the system
 * tray's API, deploy included, with a text/plain POST to localhost.
 */

const origins = trayOrigins(3009, 'tray.stacks.test')
const post = (headers: Record<string, string>) => new Request('http://localhost:3009/api/tray/action', { method: 'POST', headers, body: '{"action":"refresh"}' })

describe('system tray requests', () => {
  it('lists the tray page origins', () => {
    expect(origins).toEqual(['http://localhost:3009', 'http://127.0.0.1:3009', 'https://tray.stacks.test'])
    expect(trayOrigins(3009, null)).toEqual(['http://localhost:3009', 'http://127.0.0.1:3009'])
  })

  it('accepts the tray page writing JSON, from each of its origins', () => {
    for (const origin of origins)
      expect(isTrustedTrayRequest(post({ 'Origin': origin, 'Content-Type': 'application/json' }), origins)).toBe(true)
  })

  it('refuses another site, whatever it sends', () => {
    expect(isTrustedTrayRequest(post({ 'Origin': 'https://evil.example', 'Content-Type': 'text/plain' }), origins)).toBe(false)
    expect(isTrustedTrayRequest(post({ 'Origin': 'https://evil.example', 'Content-Type': 'application/json' }), origins)).toBe(false)
    expect(isTrustedTrayRequest(post({ 'Origin': 'http://localhost:3000', 'Content-Type': 'application/json' }), origins)).toBe(false)
    expect(isTrustedTrayRequest(new Request('http://localhost:3009/api/tray/projects', { headers: { Origin: 'https://evil.example' } }), origins)).toBe(false)
  })

  it('refuses a write that is not JSON, the kind a page can send with no preflight', () => {
    expect(isTrustedTrayRequest(post({ 'Content-Type': 'text/plain' }), origins)).toBe(false)
    expect(isTrustedTrayRequest(post({ 'Content-Type': 'application/x-www-form-urlencoded' }), origins)).toBe(false)
    expect(isTrustedTrayRequest(post({}), origins)).toBe(false)
  })

  it('accepts a request from outside any page, which runs as the developer', () => {
    expect(isTrustedTrayRequest(post({ 'Content-Type': 'application/json; charset=utf-8' }), origins)).toBe(true)
    expect(isTrustedTrayRequest(new Request('http://localhost:3009/api/tray/projects'), origins)).toBe(true)
  })
})
