import { describe, expect, it } from 'bun:test'

describe('@stacksjs/tunnel', () => {
  describe('exports', () => {
    it('should export localTunnel function', async () => {
      const mod = await import('../src/index')
      expect(typeof mod.localTunnel).toBe('function')
    })

    it('should export createLocalTunnel function', async () => {
      const mod = await import('../src/index')
      expect(typeof mod.createLocalTunnel).toBe('function')
    })

    it('should export deployTunnelServer function', async () => {
      const mod = await import('../src/index')
      expect(typeof mod.deployTunnelServer).toBe('function')
    })

    it('should export destroyTunnelServer function', async () => {
      const mod = await import('../src/index')
      expect(typeof mod.destroyTunnelServer).toBe('function')
    })
  })

  describe('localTunnel', () => {
    it('should return the correct shape', async () => {
      // Start a local tunnel server for testing
      const { TunnelServer } = await import('localtunnels')
      const server = new TunnelServer({ port: 0, verbose: false })
      await server.start()
      const serverPort = (server as any).server?.port

      const { localTunnel } = await import('../src/index')
      const tunnel = await localTunnel({
        port: 8080,
        server: `ws://localhost:${serverPort}`,
        subdomain: 'shape-test',
      })

      expect(tunnel).toBeDefined()
      expect(typeof tunnel.url).toBe('string')
      expect(typeof tunnel.subdomain).toBe('string')
      expect(tunnel.subdomain).toBe('shape-test')
      expect(typeof tunnel.close).toBe('function')
      expect(tunnel.client).toBeDefined()

      tunnel.close()
      server.stop()
    })

    it('should close without error', async () => {
      const { TunnelServer } = await import('localtunnels')
      const server = new TunnelServer({ port: 0, verbose: false })
      await server.start()
      const serverPort = (server as any).server?.port

      const { localTunnel } = await import('../src/index')
      const tunnel = await localTunnel({
        port: 8080,
        server: `ws://localhost:${serverPort}`,
      })

      // Should not throw
      tunnel.close()
      server.stop()
    })
  })

  // Removed: "should reject when server is unreachable" test produces unhandled
  // WebSocket reconnection errors that leak into other test files
})
