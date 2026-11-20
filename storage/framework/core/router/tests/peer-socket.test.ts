import { describe, expect, test } from 'bun:test'
import { peerSocket, registerPeerSource } from '../src/peer-socket'

describe('peerSocket', () => {
  test('names the address and port of a request that came over a socket', async () => {
    let seen: { address: string, port: number } | null = null
    const server = Bun.serve({
      port: 0,
      fetch(req) {
        seen = peerSocket(req)
        return new Response('ok')
      },
    })
    registerPeerSource(server)
    try {
      await fetch(`http://127.0.0.1:${server.port}/`)
      expect(seen).not.toBeNull()
      expect(seen!.address).toMatch(/127\.0\.0\.1/)
      expect(seen!.port).toBeGreaterThan(0)
      expect(seen!.port).not.toBe(server.port)
    }
    finally {
      server.stop(true)
    }
  })

  test('is null for a request built in-process', () => {
    expect(peerSocket(new Request('http://localhost/'))).toBeNull()
  })
})
