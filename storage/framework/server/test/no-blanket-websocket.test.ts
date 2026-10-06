import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The production entry must not upgrade websockets (stacksjs/stacks#2864).
 *
 * It upgraded every request that asked, on any path and unauthenticated, to
 * handlers that did nothing. Asserted against the source, because the entry
 * starts a server when imported - and because that is where the mistake would
 * be made again: adding `server.upgrade(request)` back for some feature.
 */
const entry = readFileSync(join(import.meta.dir, '../src/index.ts'), 'utf8')
const code = entry.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')

describe('the production server entry', () => {
  it('neither upgrades requests nor configures websocket handlers', () => {
    expect(code).not.toContain('.upgrade(')
    expect(code).not.toMatch(/\bwebsocket\s*:/)
  })

  it('answers a websocket request as HTTP when Bun has no websocket handlers', async () => {
    // What the entry now is: a fetch handler and no `websocket` option.
    const server = Bun.serve({ port: 0, fetch: () => new Response('not found', { status: 404 }) })
    try {
      const response = await fetch(`http://127.0.0.1:${server.port}/anything`, {
        headers: { 'Connection': 'Upgrade', 'Upgrade': 'websocket', 'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==' },
      })
      expect(response.status).toBe(404)
    }
    finally {
      server.stop(true)
    }
  })
})
